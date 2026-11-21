import { useState, useEffect, useRef } from "react";
import { coord } from "./types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import * as d3 from "d3";
import * as XLSX from "xlsx";
import "./App.css";

function App(): JSX.Element {
  const padding = { v: 16, h: 12 };
  const [svgh, setSvgH] = useState(window.innerHeight-padding.v);
  const [svgw, setSvgW] = useState((window.innerWidth/2)-padding.h);
  const [pos, setPos] = useState<coord>({x: 0, y: 0});

  const [angle, setAngle] = useState(0.0);
  const [speed, setSpeed] = useState(0.0);
  const [lineData, setLineData] = useState<coord[]>([]);

  const SVG = useRef(null);

  window.onresize = () => {
    setSvgH(window.innerHeight-padding.v);
    setSvgW((window.innerWidth/2)-padding.h);
  }

  const xscale = (x: number) => { return 20+((svgw-100)*x); };
  const yscale = (y: number) => { return svgh-20-((svgh+40)*y); };

  useEffect(() => {
    setLineData(lineData.concat(pos));

    const svg = d3.select(SVG.current);
    svg.append("path")
      .datum(lineData)
      .attr("fill", "none")
      .attr("stroke", "red")
      .attr("stroke-width", 3)
      .attr("d", d3.line<coord>()
        .x((d) => { return xscale(d.x); })
        .y((d) => { return yscale(d.y); })
      (lineData)
    ).lower();

    return () => { d3.select("svg > path").remove() };
  }, [pos])

  const toRadians = (x: number) => { return x * (Math.PI / 180); };
  const forcePrev = 20 + (40 * speed / 100);

  listen<coord>("step", e => setPos(e.payload));

  return (
    <main className="h-screen w-screen bg-[#1B1B1B] grid grid-cols-2 p-2 gap-2">
      <svg className="bg-[#242424] rounded-md" width={svgw} height={svgh} ref={SVG}>
        <defs>
          <radialGradient id="shine" cx="0.25" cy="0.25" r="0.35">
            <stop offset="0%" stop-color="#e3a8b0" />
            <stop offset="100%" stop-color="#D1495B" />
          </radialGradient>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="0" refY="5" orient="auto">
            <path d="M 0 0 L 0 10 L 10 5 Z" fill="yellow" />
          </marker>
        </defs>
        <line x1={20} x2={(forcePrev*Math.cos(toRadians(angle)))+20} y1={svgh-20} y2={svgh-((forcePrev*Math.sin(toRadians(angle)))+20)}
        stroke="yellow" strokeWidth={2} markerEnd="url(#arrow)" id="angleArrow"></line>
        <circle cx={xscale(pos.x)} cy={yscale(pos.y)} r={20} fill="url(#shine)"></circle>
      </svg>
      <form className="p-2 grid grid-cols-2 bg-[#242424] rounded-md gap-2 place-items-center">
        <b className="text-white text-2xl">Speed [m/s]</b>
        <input type="number" min={0} max={100} value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="bg-white"/>
        <b className="text-white text-2xl">Angle [deg]</b>
        <input type="number" min={0} max={90} value={angle} onChange={e => setAngle(parseFloat(e.target.value))} className="bg-white"/>
        <button className="w-full text-[#48c78e] hover:text-white hover:bg-[#48c78e] border-4
        border-r-[#297352] border-b-[#297352] border-l-[#48c78e] border-t-[#48c78e] active:border-l-[#297352]
        active:border-t-[#297352] active:border-r-[#48c78e] active:border-b-[#48c78e]
        rounded-full p-2 transition-all" onClick={(e) => {
          e.preventDefault();
          const arrow = document.getElementById("angleArrow")
          if (arrow) arrow.style.visibility = "hidden";
          invoke("calc_pos", {speed: speed, angle: toRadians(angle)});
        }}>Start</button>
        <button className="w-full text-[lightcoral] hover:text-white hover:bg-[lightcoral] border-4
        border-r-[#9C5353] border-b-[#9C5353] border-l-[lightcoral] border-t-[lightcoral] active:border-l-[#9C5353]
        active:border-t-[#9C5353] active:border-r-[lightcoral] active:border-b-[lightcoral]
        rounded-full p-2 transition-all" onClick={(e) => {
          e.preventDefault();
          const arrow = document.getElementById("angleArrow")
          if (arrow) arrow.style.visibility = "visible";
          setLineData([]);
          setPos({x: 0, y: 0});
        }}>Reset</button>
        <button onClick={(e) => {
          e.preventDefault();
          let data: string[][] = [["X", "Y"]];
          for (const point of lineData) {
            data.push([point.x.toString(), point.y.toString()]);
          }
          data.push(["", ""]);
          data.push(["Speed", "Angle"]);
          data.push([speed.toString(), angle.toString()]);

          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), "Report");
          const excelBuffer = XLSX.write(workbook, {bookType: 'xlsx', type: 'buffer'});

          //let baseBuffer = ""
          //excelBuffer.forEach((byte: number) => baseBuffer += String.fromCharCode(byte));
          //baseBuffer = btoa(baseBuffer);

          //invoke("export_data", { buffer: baseBuffer }).then((savedPath) => {
            //if (savedPath) {
              //alert(`Report successfully downloaded to: ${savedPath}`);
            //}
            //else {
              //alert("File download cancelled");
            //}
          //});

          save({ filters: [{ name: "Filter", extensions: ["xlsx"] }]}).then((savedPath) => {
            if (savedPath) {
              writeFile(savedPath, excelBuffer)
                .then(_ => alert(`Report successfully downloaded to: ${savedPath}`));
            }
            else {
              alert("File download cancelled");
            }
          });
        }} className="col-span-2 text-white font-bold rounded-lg bg-amber-400 p-4 pl-8 pr-8">Export ⭳</button>
      </form>
      <button className="fixed left-2 top-2 p-2 rounded-full bg-[#1B1B1B] opacity-70 text-white" onClick={_ => {
        invoke("greet", {x: 1.0, y: 2.0})
          .then((z) => alert(`Returned: ${z}`));
      }}>
        Test DLL
      </button>
    </main>
  );
}

export default App;

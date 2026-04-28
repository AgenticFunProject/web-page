import React from "react";

export default function ScheduleList({schedules, onSelect}){
  if(!schedules || schedules.length===0) return <div className="text-gray-600">No schedules. Perform a search to see results.</div>;
  return (
    <div className="space-y-3">
      {schedules.map(s=>(
        <div key={s.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
          <div>
            <div className="font-semibold">{s.vessel} — {s.voyage}</div>
            <div className="text-sm text-gray-600">{s.origin} → {s.destination} | ETD: {s.etd} | ETA: {s.eta}</div>
            <div className="text-sm text-gray-500">Cut-off: {s.cutoff}</div>
          </div>
          <div>
            <button onClick={()=>onSelect(s)} className="bg-green-600 text-white px-3 py-2 rounded">Get Quote</button>
          </div>
        </div>
      ))}
    </div>
  )
}

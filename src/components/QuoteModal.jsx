import React, {useState} from "react";
import { API_BASE } from "../App";

export default function QuoteModal({schedule, onClose, onQuoted}){
  const [equipment,setEquipment]=useState("20ft");
  const [qty,setQty]=useState(1);
  const [weight,setWeight]=useState(1000);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  async function getQuote(){
    setLoading(true); setErr("");
    try{
      const payload={scheduleId:schedule.id, equipment, qty, weight};
      const res = await fetch(`${API_BASE}/quotes`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      if(!res.ok) throw new Error('Quote failed');
      const data = await res.json();
      onQuoted(data);
    }catch(e){
      setErr(e.message);
    }finally{ setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4">
      <div className="bg-white rounded w-full max-w-md p-4">
        <h3 className="font-bold mb-2">Get Quote — {schedule.vessel} {schedule.voyage}</h3>
        <div className="space-y-2">
          <select value={equipment} onChange={e=>setEquipment(e.target.value)} className="border p-2 rounded w-full">
            <option>20ft</option>
            <option>40ft</option>
            <option>40ft HC</option>
          </select>
          <input type="number" min="1" value={qty} onChange={e=>setQty(Number(e.target.value))} className="border p-2 rounded w-full" />
          <input type="number" min="1" value={weight} onChange={e=>setWeight(Number(e.target.value))} className="border p-2 rounded w-full" />
          {err && <div className="text-red-600">{err}</div>}
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={onClose} className="mr-2 px-3 py-2">Cancel</button>
          <button onClick={getQuote} className="bg-blue-600 text-white px-3 py-2 rounded" disabled={loading}>{loading?'Quoting...':'Get Quote'}</button>
        </div>
      </div>
    </div>
  )
}

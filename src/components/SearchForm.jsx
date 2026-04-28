import React, {useState} from "react";
import { API_BASE } from "../App";

export default function SearchForm({onResults}){
  const [origin,setOrigin]=useState("");
  const [destination,setDestination]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  async function submit(e){
    e.preventDefault();
    setErr("");
    setLoading(true);
    try{
      const q = new URLSearchParams({origin,destination,from,to});
      const res = await fetch(`${API_BASE}/schedules?${q.toString()}`);
      if(!res.ok) throw new Error('Failed to fetch schedules');
      const data = await res.json();
      onResults(data || []);
    } catch (e) {
      console.error(e);
      setErr('Unable to fetch schedules. Please try again later.');
      onResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="bg-white p-4 rounded shadow mb-4" onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <input required className="border p-2 rounded" placeholder="Origin port" value={origin} onChange={e=>setOrigin(e.target.value)} />
        <input required className="border p-2 rounded" placeholder="Destination port" value={destination} onChange={e=>setDestination(e.target.value)} />
        <input type="date" className="border p-2 rounded" value={from} onChange={e=>setFrom(e.target.value)} />
        <input type="date" className="border p-2 rounded" value={to} onChange={e=>setTo(e.target.value)} />
      </div>
      <div className="mt-3 flex items-center">
        <button className="bg-blue-600 text-white px-4 py-2 rounded mr-3" disabled={loading}>{loading? 'Searching...':'Search'}</button>
        {err && <div className="text-red-600">{err}</div>}
      </div>
    </form>
  )
}

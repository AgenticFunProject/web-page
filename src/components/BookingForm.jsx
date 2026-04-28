import React, {useState} from "react";
import { API_BASE } from "../App";

export default function BookingForm({quote, onBooked, onCancel}){
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  async function submit(e){
    e.preventDefault();
    setLoading(true); setErr("");
    try{
      const payload={quoteId:quote.id, contact:{name,email,phone}, cargo:quote};
      const res = await fetch(`${API_BASE}/bookings`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      if(!res.ok) throw new Error('Booking failed');
      const data = await res.json();
      onBooked(data.reference);
    }catch(e){
      setErr(e.message);
    }finally{ setLoading(false); }
  }

  return (
    <form className="bg-white p-4 rounded shadow mt-4" onSubmit={submit}>
      <h2 className="font-bold mb-2">Review & Book</h2>
      <div className="mb-2">Price: {quote.total} {quote.currency} (valid until {quote.validUntil})</div>
      <div className="space-y-2">
        <input required className="border p-2 rounded w-full" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} />
        <input required type="email" className="border p-2 rounded w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border p-2 rounded w-full" placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} />
        {err && <div className="text-red-600">{err}</div>}
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={onCancel} className="mr-2 px-3 py-2">Back</button>
        <button type="submit" className="bg-green-600 text-white px-3 py-2 rounded" disabled={loading}>{loading?'Booking...':'Place Booking'}</button>
      </div>
    </form>
  )
}

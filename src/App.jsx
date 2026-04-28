import React, {useState} from "react";
import SearchForm from "./components/SearchForm";
import ScheduleList from "./components/ScheduleList";
import QuoteModal from "./components/QuoteModal";
import BookingForm from "./components/BookingForm";
import Confirmation from "./components/Confirmation";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

export default function App(){
  const [schedules,setSchedules]=useState([]);
  const [selectedSchedule,setSelectedSchedule]=useState(null);
  const [quote,setQuote]=useState(null);
  const [bookingRef,setBookingRef]=useState(null);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Customer Portal — Vessel Schedules</h1>
      {!bookingRef && <>
        <SearchForm onResults={setSchedules} />
        <ScheduleList schedules={schedules} onSelect={s=>setSelectedSchedule(s)} />
      </>}
      {selectedSchedule && !quote && <QuoteModal schedule={selectedSchedule} onClose={()=>setSelectedSchedule(null)} onQuoted={q=>{setQuote(q); setSelectedSchedule(null)}} />}
      {quote && !bookingRef && <BookingForm quote={quote} onBooked={ref=>{setBookingRef(ref); setQuote(null)}} onCancel={()=>setQuote(null)} />}
      {bookingRef && <Confirmation refId={bookingRef} />}
    </div>
  )
}

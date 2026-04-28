import React from "react";

export default function Confirmation({refId}){
  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold">Booking Confirmed</h2>
      <p className="mt-2">Reference: <span className="font-mono">{refId}</span></p>
      <p className="mt-2 text-gray-600">You will receive an email with booking details.</p>
    </div>
  )
}

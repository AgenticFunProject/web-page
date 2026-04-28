const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

function sampleSchedules(origin, destination, from, to){
  const now = new Date();
  return [1,2,3].map(i=>{
    const etd = new Date(now.getTime() + i*24*3600*1000).toISOString().slice(0,10);
    const eta = new Date(now.getTime() + (i*24+5)*3600*1000).toISOString().slice(0,10);
    return {
      id: `SCH-${origin||'ORG'}-${destination||'DST'}-${i}`,
      vessel: `Vessel ${i}`,
      voyage: `V0${i}`,
      origin: origin || 'Port A',
      destination: destination || 'Port B',
      etd,
      eta,
      cutoff: new Date(now.getTime() + (i*24-6)*3600*1000).toISOString().slice(0,10),
      equipment: [
        { type: '20ft', available: 10 },
        { type: '40ft', available: 5 },
        { type: '40ft HC', available: 2 }
      ]
    }
  })
}

app.get('/api/schedules', (req, res) => {
  const { origin, destination, from, to } = req.query;
  // Return mock schedules
  const schedules = sampleSchedules(origin, destination, from, to);
  res.json(schedules);
});

app.post('/api/quotes', (req, res) => {
  const { scheduleId, equipment, qty, weight } = req.body || {};
  // Simple pricing logic
  const base = equipment === '40ft' || equipment === '40ft HC' ? 1200 : 800;
  const weightFactor = Math.max(1, (weight || 1000) / 1000);
  const freight = Math.round(base * (qty || 1) * weightFactor);
  const surcharges = Math.round(freight * 0.12);
  const total = freight + surcharges;
  const quote = {
    id: `Q-${Math.floor(Math.random()*900000 + 100000)}`,
    scheduleId,
    equipment,
    qty,
    weight,
    total,
    currency: 'USD',
    validUntil: new Date(Date.now() + 1000*60*60*24).toISOString(), // 24h
    breakdown: { freight, surcharges }
  };
  // Simulate latency
  setTimeout(()=>res.json(quote), 300);
});

app.post('/api/bookings', (req, res) => {
  const { quoteId, contact } = req.body || {};
  const reference = `BKG-${Math.floor(Math.random()*900000 + 100000)}`;
  const booking = { reference, status: 'confirmed', quoteId, contact };
  setTimeout(()=>res.status(201).json(booking), 300);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log(`Mock API server running at http://localhost:${PORT}/api`));

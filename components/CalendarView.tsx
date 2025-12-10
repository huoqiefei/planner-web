
import React, { useState } from 'react';
import { Calendar } from '../types';

interface CalendarViewProps {
    calendars: Calendar[];
    onUpdateCalendars: (calendars: Calendar[]) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ calendars, onUpdateCalendars }) => {
    const [selId, setSelId] = useState(calendars[0]?.id);
    const [editId, setEditId] = useState<string | null>(null);
    const [editVal, setEditVal] = useState('');
    const cal = calendars.find(c => c.id === selId);
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // Month Grid
    const today = new Date();
    const grid = [];
    const startM = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < startM.getDay(); i++) grid.push(null);
    for (let i = 1; i <= 31; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), i);
        if (d.getMonth() !== today.getMonth()) break;
        grid.push(d);
    }

    const toggleDay = (i: number) => {
        if (!cal) return;
        const nw = [...cal.weekDays];
        nw[i] = !nw[i];
        onUpdateCalendars(calendars.map(c => c.id === selId ? { ...c, weekDays: nw } : c));
    };

    const toggleExc = (date: Date) => {
        if (!cal) return;
        const dateStr = date.toISOString().split('T')[0];
        const ex = cal.exceptions || [];
        const idx = ex.findIndex(e => e.date === dateStr);
        let nex = [];
        if (idx >= 0) nex = ex.filter((_, i) => i !== idx);
        else nex = [...ex, { date: dateStr, isWorking: !cal.weekDays[date.getDay()] }];
        onUpdateCalendars(calendars.map(c => c.id === selId ? { ...c, exceptions: nex } : c));
    };

    const saveEdit = () => {
        onUpdateCalendars(calendars.map(c => c.id === editId ? { ...c, name: editVal } : c));
        setEditId(null);
    };

    if (!cal) return <div>No Calendars</div>;

    return (
        <div className="flex h-full">
            <div className="w-64 border-r bg-white flex flex-col">
                <div className="p-2 border-b bg-slate-100 font-bold flex justify-between">
                    <span>Calendars</span>
                    <button onClick={() => onUpdateCalendars([...calendars, { id: 'cal' + Date.now(), name: 'New Cal', isDefault: false, hoursPerDay: 8, weekDays: [0, 1, 1, 1, 1, 1, 0].map(Boolean), exceptions: [] }])}>+</button>
                </div>
                <div className="overflow-y-auto flex-grow">
                    {calendars.map(c => (
                        <div key={c.id} onClick={() => setSelId(c.id)} onDoubleClick={() => { setEditId(c.id); setEditVal(c.name) }} className={`p-2 cursor-pointer border-b ${selId === c.id ? 'bg-blue-100' : ''}`}>
                            {editId === c.id ? 
                                <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="w-full border px-1" /> : 
                                c.name
                            }
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex-grow p-4 bg-slate-50 overflow-auto">
                <div className="mb-4">
                    <label className="font-bold block mb-1">Standard Work Week</label>
                    <div className="flex gap-1">{cal.weekDays.map((w, i) => <button key={i} onClick={() => toggleDay(i)} className={`w-8 h-8 border text-xs font-bold ${w ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-400'}`}>{days[i]}</button>)}</div>
                </div>
                <div className="bg-white border p-4 w-80 shadow-sm">
                    <div className="text-center font-bold mb-2">{today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                        {days.map(d => <div key={d} className="font-bold text-slate-400">{d}</div>)}
                        {grid.map((d, i) => {
                            if (!d) return <div key={i}></div>;
                            const dStr = d.toISOString().split('T')[0];
                            const ex = cal.exceptions?.find(e => e.date === dStr);
                            const work = ex ? ex.isWorking : cal.weekDays[d.getDay()];
                            return <div key={i} onClick={() => toggleExc(d)} className={`p-2 cursor-pointer border ${work ? 'bg-white' : 'bg-slate-200'} ${ex ? 'ring-2 ring-yellow-400' : ''}`}>{d.getDate()}</div>
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
};

export default CalendarView;
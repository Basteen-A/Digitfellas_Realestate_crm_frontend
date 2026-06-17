import React, { useState, useEffect, useRef } from 'react';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import './CalendarPicker.css';

const pad2 = (n) => String(n).padStart(2, '0');

// Date-only strings (YYYY-MM-DD) are parsed in LOCAL time. `new Date('2026-05-29')`
// would otherwise be treated as UTC midnight, which renders/serialises as the previous
// day in positive-offset timezones (e.g. IST, +5:30).
const parseCalendarValue = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const dt = new Date(val);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const CalendarPicker = ({
  value, 
  onChange, 
  type = 'date', // 'date' | 'datetime'
  minDate,
  maxDate,
  placeholder = 'Select date...',
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => parseCalendarValue(value));
  const wrapperRef = useRef(null);

  // Open the popup, anchoring it to the right edge of the field when a 300px panel
  // anchored left would overflow the viewport (mobile uses a bottom sheet via CSS).
  const togglePopup = () => {
    if (disabled) return;
    if (!isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setAlignRight(rect.left + 300 > window.innerWidth - 8);
    }
    setIsOpen((prev) => !prev);
  };
  const minD = minDate ? new Date(minDate) : null;
  const maxD = maxDate ? new Date(maxDate) : null;

  const clampToBounds = (date) => {
    const nextDate = new Date(date);
    if (minD && nextDate.getTime() < minD.getTime()) return new Date(minD);
    if (maxD && nextDate.getTime() > maxD.getTime()) return new Date(maxD);
    return nextDate;
  };

  // For date-only pickers emit a local YYYY-MM-DD string so the selection is never
  // shifted across a day boundary by UTC conversion, and so it matches the quick-chip
  // values. datetime pickers keep the full ISO timestamp.
  const emitChange = (dateObj) => {
    if (type === 'date') {
      onChange(`${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`);
    } else {
      onChange(dateObj.toISOString());
    }
  };

  // Sync prop value
  useEffect(() => {
    const d = parseCalendarValue(value);
    if (d) {
      setSelectedDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handleDateSelect = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    
    // Preserve time if datetime and date was already selected
    if (type === 'datetime' && selectedDate) {
      newDate.setHours(selectedDate.getHours());
      newDate.setMinutes(selectedDate.getMinutes());
    } else if (type === 'datetime') {
      // Default to 12:00 PM
      newDate.setHours(12);
      newDate.setMinutes(0);
    }

    const nextDate = clampToBounds(newDate);

    setSelectedDate(nextDate);
    emitChange(nextDate);
    if (type === 'date') setIsOpen(false);
  };



  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysCount = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    
    const days = [];
    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="cp-day empty"></div>);
    }

    // Days
    for (let i = 1; i <= daysCount; i++) {
      const d = new Date(year, month, i);
      const isSelected = selectedDate && 
                         selectedDate.getDate() === i && 
                         selectedDate.getMonth() === month && 
                         selectedDate.getFullYear() === year;
      const isToday = new Date().toDateString() === d.toDateString();
      
      let isDisabled = false;
      if (minD && d.setHours(0,0,0,0) < minD.setHours(0,0,0,0)) isDisabled = true;
      if (maxD && d.setHours(0,0,0,0) > maxD.setHours(0,0,0,0)) isDisabled = true;

      days.push(
        <button
          type="button"
          key={i}
          className={`cp-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
          disabled={isDisabled}
          onClick={() => handleDateSelect(i)}
        >
          {i}
        </button>
      );
    }

    return days;
  };

  const changeMonth = (offset) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const setToday = () => {
    const today = new Date();
    if (type === 'datetime') {
      today.setMinutes(Math.ceil(today.getMinutes() / 15) * 15); // round to next 15m
    }
    const nextDate = clampToBounds(today);
    setSelectedDate(nextDate);
    setCurrentMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    emitChange(nextDate);
    if (type === 'date') setIsOpen(false);
  };

  const displayValue = selectedDate ? (
    type === 'datetime' 
      ? selectedDate.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  ) : '';

  return (
    <div className={`cp-wrapper ${className}`} ref={wrapperRef}>
      <div
        className={`cp-input ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
        onClick={togglePopup}
      >
        <div className="cp-value">{displayValue || <span className="cp-placeholder">{placeholder}</span>}</div>
        <div className="cp-icon"><CalendarDaysIcon style={{ width: 16, height: 16 }} /></div>
      </div>

      {isOpen && (
        <div className={`cp-popup ${alignRight ? 'cp-popup-right' : ''}`}>
          <div className="cp-header">
            <button type="button" className="cp-nav-btn" onClick={() => changeMonth(-1)}><ChevronLeftIcon style={{ width: 14, height: 14 }} /></button>
            <div className="cp-month-label">
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            <button type="button" className="cp-nav-btn" onClick={() => changeMonth(1)}><ChevronRightIcon style={{ width: 14, height: 14 }} /></button>
          </div>

          <div className="cp-weekdays">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="cp-days-grid">
            {renderCalendar()}
          </div>

          {type === 'datetime' && (
            <div className="cp-time-selector">
              <div className="cp-time-label">Time</div>
              <div className="cp-time-inputs">
                <input 
                  type="number"
                  className="cp-time-input"
                  min="1" max="12"
                  value={selectedDate ? ((selectedDate.getHours() % 12) || 12).toString().padStart(2, '0') : '12'}
                  onChange={(e) => {
                    if (!selectedDate) return;
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val)) return;
                    if (val > 12) val = 12;
                    if (val < 1) val = 1;
                    const isPm = selectedDate.getHours() >= 12;
                    let newH = val === 12 ? 0 : val;
                    if (isPm) newH += 12;
                    const newD = new Date(selectedDate);
                    newD.setHours(newH);
                    const nextDate = clampToBounds(newD);
                    setSelectedDate(nextDate);
                    emitChange(nextDate);
                  }}
                  disabled={!selectedDate}
                />
                <span>:</span>
                <input 
                  type="number"
                  className="cp-time-input"
                  min="0" max="59"
                  value={selectedDate ? selectedDate.getMinutes().toString().padStart(2, '0') : '00'}
                  onChange={(e) => {
                    if (!selectedDate) return;
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val)) return;
                    if (val > 59) val = 59;
                    if (val < 0) val = 0;
                    const newD = new Date(selectedDate);
                    newD.setMinutes(val);
                    const nextDate = clampToBounds(newD);
                    setSelectedDate(nextDate);
                    emitChange(nextDate);
                  }}
                  disabled={!selectedDate}
                />
                <button 
                  type="button" 
                  className="cp-ampm-btn"
                  onClick={() => {
                    if (!selectedDate) return;
                    const newD = new Date(selectedDate);
                    const h = newD.getHours();
                    newD.setHours(h >= 12 ? h - 12 : h + 12);
                    const nextDate = clampToBounds(newD);
                    setSelectedDate(nextDate);
                    emitChange(nextDate);
                  }}
                  disabled={!selectedDate}
                >
                  {selectedDate && selectedDate.getHours() >= 12 ? 'PM' : 'AM'}
                </button>
              </div>
            </div>
          )}

          <div className="cp-footer">
            <button type="button" className="cp-btn-ghost" onClick={() => { setSelectedDate(null); onChange(''); setIsOpen(false); }}>Clear</button>
            <button type="button" className="cp-btn-primary" onClick={setToday}>
              {type === 'datetime' ? 'Now' : 'Today'}
            </button>
            {type === 'datetime' && (
              <button type="button" className="cp-btn-primary" onClick={() => setIsOpen(false)}>Done</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPicker;

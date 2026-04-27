import React, { useState, useEffect, useRef } from 'react';
import './CalendarPicker.css';

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);
  const wrapperRef = useRef(null);
  const minD = minDate ? new Date(minDate) : null;
  const maxD = maxDate ? new Date(maxDate) : null;

  const clampToBounds = (date) => {
    const nextDate = new Date(date);
    if (minD && nextDate.getTime() < minD.getTime()) return new Date(minD);
    if (maxD && nextDate.getTime() > maxD.getTime()) return new Date(maxD);
    return nextDate;
  };

  // Sync prop value
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setSelectedDate(d);
        setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
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
    onChange(nextDate.toISOString());
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
    onChange(nextDate.toISOString());
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
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="cp-value">{displayValue || <span className="cp-placeholder">{placeholder}</span>}</div>
        <div className="cp-icon">🗓️</div>
      </div>

      {isOpen && (
        <div className="cp-popup">
          <div className="cp-header">
            <button type="button" className="cp-nav-btn" onClick={() => changeMonth(-1)}>❮</button>
            <div className="cp-month-label">
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            <button type="button" className="cp-nav-btn" onClick={() => changeMonth(1)}>❯</button>
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
                    onChange(nextDate.toISOString());
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
                    onChange(nextDate.toISOString());
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
                    onChange(nextDate.toISOString());
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

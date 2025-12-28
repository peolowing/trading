# Editable Fields in Position Detail - Implementation Guide

## 📋 Overview

Implemented inline editing for three critical position management fields in Position Detail view:
1. **Stop (nu)** - Current stop price
2. **Target (pris)** - Current target price
3. **Trailing-metod** - Trailing stop method

## ✅ What's Editable

### 1. Stop (nu)
- **Location**: Aktuell Förvaltning section
- **Type**: Number input (decimal)
- **Validation**:
  - Must be below entry price (for longs)
  - Must be a valid number
- **Event log**: "Stop flyttad från X → Y"

### 2. Target (pris)
- **Location**: Aktuell Förvaltning section (new row added)
- **Type**: Number input (decimal)
- **Validation**:
  - Must be above current price (for longs)
  - Must be a valid number
- **Event log**: "Target ändrad från X → Y"
- **Note**: Shows actual target price + percentage distance on separate row

### 3. Trailing-metod
- **Location**: Aktuell Förvaltning section
- **Type**: Dropdown select
- **Options**: EMA20, EMA50, ATR, Manual
- **Validation**: Must be one of allowed values
- **Event log**: "Trailing-metod ändrad från X → Y"

## 🔒 What's NOT Editable (Historical Integrity)

### Entry Journal Section
All fields in this section are **locked** after entry:
- Entry-datum
- Entry-pris
- Position size (initial)
- Initial risk (R)
- Initial stop
- Target (initial)
- Setup
- Entry Rationale

**Why**: These represent historical facts at the moment of entry. Changing them corrupts the audit trail and prevents learning from past decisions.

### Calculated Fields
- Aktuellt pris (market-driven)
- R nu (calculated)
- EXIT-STATUS (system-determined)

## 🎨 UX Pattern

### Click to Edit
1. **Hover**: Field background changes to indicate editability
2. **Click**: Field converts to input/select with current value
3. **Edit**: User changes value
4. **Confirm**:
   - Click ✓ button
   - OR press Enter
5. **Cancel**:
   - Click ✕ button
   - OR press Escape

### Visual States
- **Default**: Light gray background on hover (`#f1f5f9`)
- **Hover**: Slightly darker (`#e2e8f0`)
- **Editing**: Blue border (`#3b82f6`), focused input
- **Disabled** (after exit): No background, no cursor change

### Keyboard Shortcuts
- **Enter**: Save changes
- **Escape**: Cancel editing

## 🔧 Frontend Implementation

### Files Modified
- **[PositionDetail.jsx](src/components/PositionDetail.jsx:1-1200)**

### State Added (lines 49-55)
```javascript
const [editingStop, setEditingStop] = useState(false);
const [editingTarget, setEditingTarget] = useState(false);
const [editingTrailing, setEditingTrailing] = useState(false);
const [tempStop, setTempStop] = useState('');
const [tempTarget, setTempTarget] = useState('');
const [tempTrailing, setTempTrailing] = useState('');
```

### Handler Functions (lines 194-313)
- `handleUpdateStop()` - Updates current_stop with validation
- `handleUpdateTarget()` - Updates current_target with validation
- `handleUpdateTrailing()` - Updates trailing_type

### UI Updates
- **Stop (nu)**: Lines 626-707 - Inline edit with number input
- **Trailing-metod**: Lines 714-798 - Dropdown select
- **Target (pris)**: Lines 800-881 - New row with inline edit
- **Target kvar**: Lines 882-887 - Percentage distance (read-only)

## 🔧 Backend Implementation

### New Endpoint
**POST /api/portfolio/update-field/:ticker**

**Location**: [server.js:1994-2050](server.js:1994-2050)

**Request Body**:
```json
{
  "field": "current_stop",
  "value": 246.00,
  "event_description": "Stop flyttad från 235.00 → 246.00"
}
```

**Allowed Fields**:
- `current_stop`
- `current_target`
- `trailing_type`

**Response**:
```json
{
  "message": "Field updated successfully"
}
```

**Features**:
- Field whitelist validation
- Automatic `last_updated` timestamp
- Optional event logging to `portfolio_events` table
- Error handling with descriptive messages

## 📊 Database Impact

### Modified Tables

#### `portfolio` table
Fields that can be updated:
- `current_stop` (NUMERIC)
- `current_target` (NUMERIC)
- `trailing_type` (TEXT)
- `last_updated` (DATE) - auto-set

#### `portfolio_events` table
New event types logged:
- `STOP_MOVED` - When stop is updated
- `NOTE` - When target or trailing method is updated

**Note**: If `portfolio_events` table doesn't exist, event logging is gracefully skipped.

## 🎯 Usage Example

### Scenario: Trailing Stop in Winning Trade
1. Position is up +2.4R
2. Trader decides to move stop to break-even
3. Click on "Stop (nu)" value (246.00)
4. Field becomes editable input
5. Enter new value: 240.00 (entry price)
6. Press Enter or click ✓
7. Alert: "✅ Stop uppdaterad till 240.00"
8. Event log shows: "Stop flyttad från 246.00 → 240.00"
9. Page refreshes with new data

### Scenario: Extending Target
1. Position moving well, strong trend
2. Click on "Target (pris)" value (250.00)
3. Enter new higher target: 260.00
4. Validation passes (above current price)
5. Press Enter
6. Alert: "✅ Target uppdaterad till 260.00"
7. Event log shows: "Target ändrad från 250.00 → 260.00"
8. "Target kvar" percentage auto-updates

### Scenario: Switching Trailing Method
1. Market becomes choppy
2. Click on "Trailing-metod" (EMA20)
3. Dropdown opens
4. Select "Manual"
5. Click ✓
6. Alert: "✅ Trailing-metod uppdaterad till Manual"
7. Event log shows: "Trailing-metod ändrad från EMA20 → Manual"

## ✅ Benefits

### 1. **Audit Trail Preservation**
- Entry data remains immutable
- All changes logged in events table
- Can review decision-making process

### 2. **Dynamic Position Management**
- Adjust to changing market conditions
- Quick tactical adjustments
- No need to exit and re-enter

### 3. **Learning Loop**
- Compare initial plan vs. actual management
- See when and why stops/targets were adjusted
- Identify patterns in successful vs. failed trades

### 4. **Flexibility Without Chaos**
- Only critical management fields are editable
- Validation prevents invalid states
- Disabled after exit (can't rewrite history)

## 🚀 Testing Checklist

- [ ] Click Stop field → input appears with current value
- [ ] Enter valid stop → saves and logs event
- [ ] Enter invalid stop (above entry) → shows error
- [ ] Press Escape while editing → cancels without saving
- [ ] Click Target field → input appears
- [ ] Enter valid target → saves and updates percentage
- [ ] Enter invalid target (below price) → shows error
- [ ] Click Trailing method → dropdown appears
- [ ] Select different method → saves and logs event
- [ ] After position exit → fields not editable
- [ ] Check event log → shows all changes with timestamps
- [ ] Backend error → shows user-friendly alert

## 📝 Future Enhancements

### Potential Additions
1. **Position Size** - After partial exits, allow manual adjustment
2. **Batch Edit** - Edit multiple fields before saving
3. **Edit History** - Show changelog inline (who changed what when)
4. **Undo** - Revert last change within 5 minutes
5. **Templates** - Save common stop/target adjustment patterns

### Not Recommended
- ❌ Editing entry journal (corrupts learning)
- ❌ Editing P&L (calculated field)
- ❌ Editing dates (audit trail integrity)

## 🎓 Design Philosophy

> **Entry data = Historical truth**
> Entry journal captures what you *thought* at the moment of entry.
> Editing it is like rewriting your diary after knowing the outcome.

> **Management data = Current reality**
> Stops, targets, and methods should adapt to market conditions.
> These are living decisions, not historical facts.

> **Calculated data = Market's verdict**
> Price, P&L, R-multiple are objective measurements.
> You observe them, you don't edit them.

This separation builds **edge through honest self-assessment**.

---

## 🔗 Related Documentation

- [POSITION_DETAIL_JOURNAL_UPDATE.md](POSITION_DETAIL_JOURNAL_UPDATE.md:1-1) - Journal integration
- [ENTRY_MODAL_INTEGRATION.md](ENTRY_MODAL_INTEGRATION.md:1-364) - Entry process
- [COMPLETE_MIGRATION.sql](COMPLETE_MIGRATION.sql:1-87) - Database setup

---

**Implementation Date**: 2025-12-28
**Status**: ✅ Complete - Frontend + Backend + Documentation

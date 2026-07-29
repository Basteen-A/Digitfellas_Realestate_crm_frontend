import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import AuthedAudio from '../../../components/AuthedAudio';
import projectApi from '../../../api/projectApi';
import customerTypeApi from '../../../api/customerTypeApi';
import motivationApi from '../../../api/motivationApi';
import locationApi from '../../../api/locationApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import siteVisitApi from '../../../api/siteVisitApi';
import statusRemarkApi from '../../../api/statusRemarkApi';
import inventoryUnitApi from '../../../api/inventoryUnitApi';
import projectPhaseApi from '../../../api/projectPhaseApi';
import paymentPlanApi from '../../../api/paymentPlanApi';
// userApi import removed — TC locations now fetched via leadWorkflowApi.getMyMappedLocations
// customerTypeApi removed — Customer Type field removed from TC lead creation
import { formatCurrency, formatDate, formatDateTime, formatDateTimeInTimeZone, formatLocation, cleanRepeatingLocation } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { badgeStyle } from '../../../utils/badgeColors';
import VoiceNoteField from '../../../components/common/VoiceNoteField';
import { canUseVoiceNotes } from '../../../utils/voiceNotes';

import {
  getWorkspaceTitle,
  buildStageOptions,
  buildStatusOptions,
  getActionsForRole,
  ROLE_LABELS,
} from './workflowConfig';
import {
  FACING_OPTIONS, PAYMENT_TYPE_OPTIONS, DECISION_MAKER_OPTIONS, AGE_BRACKET_OPTIONS,
  TIMELINE_OPTIONS, EMPTY_VISIT_DETAILS, isVisitDetailsComplete, pickVisitDetails,
} from './siteVisitFields';
import CalendarPicker from '../../../components/common/CalendarPicker';
import {
  PlusCircleIcon,
  XMarkIcon,
  UserIcon,
  TagIcon,
  MapPinIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentListIcon,
  NoSymbolIcon,
  TrashIcon,
  HandRaisedIcon,
  SparklesIcon,
  BanknotesIcon,
  HomeModernIcon,
  IdentificationIcon,
  TableCellsIcon,
  BoltIcon,
  FunnelIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  ArrowDownLeftIcon,
} from '@heroicons/react/24/outline';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { followUpMaxDate, followUpLimitError } from '../../../utils/followUpLimits';
import './LeadWorkspacePage.css';

const INDIAN_STATES_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const NEW_LEAD_REMARK_CHIPS = ['Hot lead', 'Requested call back', 'Needs brochure', 'Budget discussed', 'Location priority'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NEW_LEAD_FOLLOW_UP_SHORTCUTS = [
  { label: 'Today ', kind: 'dayOffset', dayOffset: 0, hour: 18, minute: 0 },
  { label: 'Tomorrow', kind: 'dayOffset', dayOffset: 1, hour: 11, minute: 0 },
  { label: 'This Sat ', kind: 'weekday', weekday: 6, hour: 11, minute: 0 },
  { label: 'This Sun', kind: 'weekday', weekday: 0, hour: 11, minute: 0 },
];

const COUNTRY_CODES = [
  { label: 'Afghanistan (+93)', value: '+93' },
  { label: 'Albania (+355)', value: '+355' },
  { label: 'Algeria (+213)', value: '+213' },
  { label: 'American Samoa (+1)', value: '+1' },
  { label: 'Andorra (+376)', value: '+376' },
  { label: 'Angola (+244)', value: '+244' },
  { label: 'Anguilla (+1)', value: '+1' },
  { label: 'Antigua and Barbuda (+1)', value: '+1' },
  { label: 'Argentina (+54)', value: '+54' },
  { label: 'Armenia (+374)', value: '+374' },
  { label: 'Aruba (+297)', value: '+297' },
  { label: 'Australia (+61)', value: '+61' },
  { label: 'Austria (+43)', value: '+43' },
  { label: 'Azerbaijan (+994)', value: '+994' },
  { label: 'Bahamas (+1)', value: '+1' },
  { label: 'Bahrain (+973)', value: '+973' },
  { label: 'Bangladesh (+880)', value: '+880' },
  { label: 'Barbados (+1)', value: '+1' },
  { label: 'Belarus (+375)', value: '+375' },
  { label: 'Belgium (+32)', value: '+32' },
  { label: 'Belize (+501)', value: '+501' },
  { label: 'Benin (+229)', value: '+229' },
  { label: 'Bermuda (+1)', value: '+1' },
  { label: 'Bhutan (+975)', value: '+975' },
  { label: 'Bolivia (+591)', value: '+591' },
  { label: 'Bosnia and Herzegovina (+387)', value: '+387' },
  { label: 'Botswana (+267)', value: '+267' },
  { label: 'Brazil (+55)', value: '+55' },
  { label: 'British Indian Ocean Territory (+246)', value: '+246' },
  { label: 'British Virgin Islands (+1)', value: '+1' },
  { label: 'Brunei (+673)', value: '+673' },
  { label: 'Bulgaria (+359)', value: '+359' },
  { label: 'Burkina Faso (+226)', value: '+226' },
  { label: 'Burundi (+257)', value: '+257' },
  { label: 'Cambodia (+855)', value: '+855' },
  { label: 'Cameroon (+237)', value: '+237' },
  { label: 'Canada (+1)', value: '+1' },
  { label: 'Cape Verde (+238)', value: '+238' },
  { label: 'Cayman Islands (+1)', value: '+1' },
  { label: 'Central African Republic (+236)', value: '+236' },
  { label: 'Chad (+235)', value: '+235' },
  { label: 'Chile (+56)', value: '+56' },
  { label: 'China (+86)', value: '+86' },
  { label: 'Christmas Island (+61)', value: '+61' },
  { label: 'Cocos Islands (+61)', value: '+61' },
  { label: 'Colombia (+57)', value: '+57' },
  { label: 'Comoros (+269)', value: '+269' },
  { label: 'Cook Islands (+682)', value: '+682' },
  { label: 'Costa Rica (+506)', value: '+506' },
  { label: 'Croatia (+385)', value: '+385' },
  { label: 'Cuba (+53)', value: '+53' },
  { label: 'Cyprus (+357)', value: '+357' },
  { label: 'Czech Republic (+420)', value: '+420' },
  { label: 'Democratic Republic of the Congo (+243)', value: '+243' },
  { label: 'Denmark (+45)', value: '+45' },
  { label: 'Djibouti (+253)', value: '+253' },
  { label: 'Dominica (+1)', value: '+1' },
  { label: 'Dominican Republic (+1)', value: '+1' },
  { label: 'East Timor (+670)', value: '+670' },
  { label: 'Ecuador (+593)', value: '+593' },
  { label: 'Egypt (+20)', value: '+20' },
  { label: 'El Salvador (+503)', value: '+503' },
  { label: 'Equatorial Guinea (+240)', value: '+240' },
  { label: 'Eritrea (+291)', value: '+291' },
  { label: 'Estonia (+372)', value: '+372' },
  { label: 'Ethiopia (+251)', value: '+251' },
  { label: 'Falkland Islands (+500)', value: '+500' },
  { label: 'Faroe Islands (+298)', value: '+298' },
  { label: 'Fiji (+679)', value: '+679' },
  { label: 'Finland (+358)', value: '+358' },
  { label: 'France (+33)', value: '+33' },
  { label: 'French Guiana (+594)', value: '+594' },
  { label: 'French Polynesia (+689)', value: '+689' },
  { label: 'Gabon (+241)', value: '+241' },
  { label: 'Gambia (+220)', value: '+220' },
  { label: 'Georgia (+995)', value: '+995' },
  { label: 'Germany (+49)', value: '+49' },
  { label: 'Ghana (+233)', value: '+233' },
  { label: 'Gibraltar (+350)', value: '+350' },
  { label: 'Greece (+30)', value: '+30' },
  { label: 'Greenland (+299)', value: '+299' },
  { label: 'Grenada (+1)', value: '+1' },
  { label: 'Guadeloupe (+590)', value: '+590' },
  { label: 'Guam (+1)', value: '+1' },
  { label: 'Guatemala (+502)', value: '+502' },
  { label: 'Guernsey (+44)', value: '+44' },
  { label: 'Guinea (+224)', value: '+224' },
  { label: 'Guinea-Bissau (+245)', value: '+245' },
  { label: 'Guyana (+592)', value: '+592' },
  { label: 'Haiti (+509)', value: '+509' },
  { label: 'Honduras (+504)', value: '+504' },
  { label: 'Hong Kong (+852)', value: '+852' },
  { label: 'Hungary (+36)', value: '+36' },
  { label: 'Iceland (+354)', value: '+354' },
  { label: 'India (+91)', value: '+91' },
  { label: 'Indonesia (+62)', value: '+62' },
  { label: 'Iran (+98)', value: '+98' },
  { label: 'Iraq (+964)', value: '+964' },
  { label: 'Ireland (+353)', value: '+353' },
  { label: 'Isle of Man (+44)', value: '+44' },
  { label: 'Israel (+972)', value: '+972' },
  { label: 'Italy (+39)', value: '+39' },
  { label: 'Ivory Coast (+225)', value: '+225' },
  { label: 'Jamaica (+1)', value: '+1' },
  { label: 'Japan (+81)', value: '+81' },
  { label: 'Jersey (+44)', value: '+44' },
  { label: 'Jordan (+962)', value: '+962' },
  { label: 'Kazakhstan (+7)', value: '+7' },
  { label: 'Kenya (+254)', value: '+254' },
  { label: 'Kiribati (+686)', value: '+686' },
  { label: 'Kosovo (+383)', value: '+383' },
  { label: 'Kuwait (+965)', value: '+965' },
  { label: 'Kyrgyzstan (+996)', value: '+996' },
  { label: 'Laos (+856)', value: '+856' },
  { label: 'Latvia (+371)', value: '+371' },
  { label: 'Lebanon (+961)', value: '+961' },
  { label: 'Lesotho (+266)', value: '+266' },
  { label: 'Liberia (+231)', value: '+231' },
  { label: 'Libya (+218)', value: '+218' },
  { label: 'Liechtenstein (+423)', value: '+423' },
  { label: 'Lithuania (+370)', value: '+370' },
  { label: 'Luxembourg (+352)', value: '+352' },
  { label: 'Macau (+853)', value: '+853' },
  { label: 'Macedonia (+389)', value: '+389' },
  { label: 'Madagascar (+261)', value: '+261' },
  { label: 'Malawi (+265)', value: '+265' },
  { label: 'Malaysia (+60)', value: '+60' },
  { label: 'Maldives (+960)', value: '+960' },
  { label: 'Mali (+223)', value: '+223' },
  { label: 'Malta (+356)', value: '+356' },
  { label: 'Marshall Islands (+692)', value: '+692' },
  { label: 'Martinique (+596)', value: '+596' },
  { label: 'Mauritania (+222)', value: '+222' },
  { label: 'Mauritius (+230)', value: '+230' },
  { label: 'Mayotte (+262)', value: '+262' },
  { label: 'Mexico (+52)', value: '+52' },
  { label: 'Micronesia (+691)', value: '+691' },
  { label: 'Moldova (+373)', value: '+373' },
  { label: 'Monaco (+377)', value: '+377' },
  { label: 'Mongolia (+976)', value: '+976' },
  { label: 'Montenegro (+382)', value: '+382' },
  { label: 'Montserrat (+1)', value: '+1' },
  { label: 'Morocco (+212)', value: '+212' },
  { label: 'Mozambique (+258)', value: '+258' },
  { label: 'Myanmar (+95)', value: '+95' },
  { label: 'Namibia (+264)', value: '+264' },
  { label: 'Nauru (+674)', value: '+674' },
  { label: 'Nepal (+977)', value: '+977' },
  { label: 'Netherlands (+31)', value: '+31' },
  { label: 'Netherlands Antilles (+599)', value: '+599' },
  { label: 'New Caledonia (+687)', value: '+687' },
  { label: 'New Zealand (+64)', value: '+64' },
  { label: 'Nicaragua (+505)', value: '+505' },
  { label: 'Niger (+227)', value: '+227' },
  { label: 'Nigeria (+234)', value: '+234' },
  { label: 'Niue (+683)', value: '+683' },
  { label: 'North Korea (+850)', value: '+850' },
  { label: 'Northern Mariana Islands (+1)', value: '+1' },
  { label: 'Norway (+47)', value: '+47' },
  { label: 'Oman (+968)', value: '+968' },
  { label: 'Pakistan (+92)', value: '+92' },
  { label: 'Palau (+680)', value: '+680' },
  { label: 'Palestine (+970)', value: '+970' },
  { label: 'Panama (+507)', value: '+507' },
  { label: 'Papua New Guinea (+675)', value: '+675' },
  { label: 'Paraguay (+595)', value: '+595' },
  { label: 'Peru (+51)', value: '+51' },
  { label: 'Philippines (+63)', value: '+63' },
  { label: 'Pitcairn (+64)', value: '+64' },
  { label: 'Poland (+48)', value: '+48' },
  { label: 'Portugal (+351)', value: '+351' },
  { label: 'Puerto Rico (+1)', value: '+1' },
  { label: 'Qatar (+974)', value: '+974' },
  { label: 'Republic of the Congo (+242)', value: '+242' },
  { label: 'Reunion (+262)', value: '+262' },
  { label: 'Romania (+40)', value: '+40' },
  { label: 'Russia (+7)', value: '+7' },
  { label: 'Rwanda (+250)', value: '+250' },
  { label: 'Saint Barthelemy (+590)', value: '+590' },
  { label: 'Saint Helena (+290)', value: '+290' },
  { label: 'Saint Kitts and Nevis (+1)', value: '+1' },
  { label: 'Saint Lucia (+1)', value: '+1' },
  { label: 'Saint Martin (+590)', value: '+590' },
  { label: 'Saint Pierre and Miquelon (+508)', value: '+508' },
  { label: 'Saint Vincent and the Grenadines (+1)', value: '+1' },
  { label: 'Samoa (+685)', value: '+685' },
  { label: 'San Marino (+378)', value: '+378' },
  { label: 'Sao Tome and Principe (+239)', value: '+239' },
  { label: 'Saudi Arabia (+966)', value: '+966' },
  { label: 'Senegal (+221)', value: '+221' },
  { label: 'Serbia (+381)', value: '+381' },
  { label: 'Seychelles (+248)', value: '+248' },
  { label: 'Sierra Leone (+232)', value: '+232' },
  { label: 'Singapore (+65)', value: '+65' },
  { label: 'Slovakia (+421)', value: '+421' },
  { label: 'Slovenia (+386)', value: '+386' },
  { label: 'Solomon Islands (+677)', value: '+677' },
  { label: 'Somalia (+252)', value: '+252' },
  { label: 'South Africa (+27)', value: '+27' },
  { label: 'South Korea (+82)', value: '+82' },
  { label: 'South Sudan (+211)', value: '+211' },
  { label: 'Spain (+34)', value: '+34' },
  { label: 'Sri Lanka (+94)', value: '+94' },
  { label: 'Sudan (+249)', value: '+249' },
  { label: 'Suriname (+597)', value: '+597' },
  { label: 'Svalbard and Jan Mayen (+47)', value: '+47' },
  { label: 'Swaziland (+268)', value: '+268' },
  { label: 'Sweden (+46)', value: '+46' },
  { label: 'Switzerland (+41)', value: '+41' },
  { label: 'Syria (+963)', value: '+963' },
  { label: 'Taiwan (+886)', value: '+886' },
  { label: 'Tajikistan (+992)', value: '+992' },
  { label: 'Tanzania (+255)', value: '+255' },
  { label: 'Thailand (+66)', value: '+66' },
  { label: 'Togo (+228)', value: '+228' },
  { label: 'Tokelau (+690)', value: '+690' },
  { label: 'Tonga (+676)', value: '+676' },
  { label: 'Trinidad and Tobago (+1)', value: '+1' },
  { label: 'Tunisia (+216)', value: '+216' },
  { label: 'Turkey (+90)', value: '+90' },
  { label: 'Turkmenistan (+993)', value: '+993' },
  { label: 'Turks and Caicos Islands (+1)', value: '+1' },
  { label: 'Tuvalu (+688)', value: '+688' },
  { label: 'U.S. Virgin Islands (+1)', value: '+1' },
  { label: 'Uganda (+256)', value: '+256' },
  { label: 'Ukraine (+380)', value: '+380' },
  { label: 'United Arab Emirates (+971)', value: '+971' },
  { label: 'United Kingdom (+44)', value: '+44' },
  { label: 'United States (+1)', value: '+1' },
  { label: 'Uruguay (+598)', value: '+598' },
  { label: 'Uzbekistan (+998)', value: '+998' },
  { label: 'Vanuatu (+678)', value: '+678' },
  { label: 'Vatican (+379)', value: '+379' },
  { label: 'Venezuela (+58)', value: '+58' },
  { label: 'Vietnam (+84)', value: '+84' },
  { label: 'Wallis and Futuna (+681)', value: '+681' },
  { label: 'Western Sahara (+212)', value: '+212' },
  { label: 'Yemen (+967)', value: '+967' },
  { label: 'Zambia (+260)', value: '+260' },
  { label: 'Zimbabwe (+263)', value: '+263' },
];

const sanitizePhoneNumberInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 12);

const sanitizeCountryCodeDigits = (value) => String(value || '').replace(/\D/g, '').slice(0, 4);

const phoneMatchesAcrossCountryCode = (candidatePhone, inputPhone, countryCode = '+91') => {
  const candidateDigits = sanitizePhoneNumberInput(candidatePhone);
  const inputDigits = sanitizePhoneNumberInput(inputPhone);

  if (!candidateDigits || !inputDigits) return false;
  if (candidateDigits === inputDigits) return true;

  const countryCodeDigits = sanitizeCountryCodeDigits(countryCode);
  if (countryCodeDigits) {
    if (candidateDigits === `${countryCodeDigits}${inputDigits}`) return true;
    if (inputDigits.startsWith(countryCodeDigits) && candidateDigits === inputDigits.slice(countryCodeDigits.length)) return true;
    if (candidateDigits.startsWith(countryCodeDigits) && inputDigits === candidateDigits.slice(countryCodeDigits.length)) return true;
  }

  const lengthDiff = Math.abs(candidateDigits.length - inputDigits.length);
  if (lengthDiff > 4) return false;

  return candidateDigits.endsWith(inputDigits) || inputDigits.endsWith(candidateDigits);
};

// Build an E.164 string from a dial code ('+91') and the national part. If the
// user typed the full international number (incl. the country code) into the
// national field, the code is not prepended twice — but only when re-prepending
// would be invalid, so normal national numbers are never altered.
const buildE164Phone = (dialCode, localNumber) => {
  const digits = sanitizePhoneNumberInput(localNumber);
  const dial = sanitizeCountryCodeDigits(dialCode);
  if (!digits || !dial) return '';
  try {
    if (digits.startsWith(dial) && isValidPhoneNumber(`+${digits}`) && !isValidPhoneNumber(`+${dial}${digits}`)) {
      return `+${digits}`;
    }
  } catch { /* fall through to naive assembly */ }
  return `+${dial}${digits}`;
};

// Production-grade per-country validity (correct length AND valid prefix) via
// Google's libphonenumber. dialCode is like '+91'; localNumber is the national part.
const isValidPhoneForCountry = (dialCode, localNumber) => {
  const e164 = buildE164Phone(dialCode, localNumber);
  if (!e164) return false;
  try {
    return isValidPhoneNumber(e164);
  } catch {
    return false;
  }
};

// Mirrors the server: a lead is re-engageable when closed-lost, terminal, OR
// already BOOKED. A booked lead's booking lives independently on the collection
// side, so a fresh enquiry from the same contact may be taken as a new lead.
const REENGAGEABLE_STATUS_CODES = ['LOST', 'CLOSED_LOST', 'COLD_LOST', 'JUNK', 'SPAM', 'BOOKED'];
const REENGAGEABLE_STAGE_CODES = ['CLOSED_LOST', 'BOOKING'];

const isBookedLead = (lead) => {
  const stageCode = String(lead?.stageCode || lead?.stage?.stage_code || '').trim().toUpperCase();
  const statusCode = String(lead?.statusCode || lead?.status_code || lead?.status?.status_code || '')
    .trim().toUpperCase().replace(/[\s-]+/g, '_');
  return stageCode === 'BOOKING' || statusCode === 'BOOKED';
};

const isClosedLostLead = (lead) => {
  const stageCode = String(lead?.stageCode || lead?.stage?.stage_code || '').trim().toUpperCase();
  if (REENGAGEABLE_STAGE_CODES.includes(stageCode)) return true;
  const statusCode = String(lead?.statusCode || lead?.status_code || lead?.status?.status_code || '')
    .trim().toUpperCase().replace(/[\s-]+/g, '_');
  return REENGAGEABLE_STATUS_CODES.includes(statusCode);
};

const getLeadOwnerName = (lead) => {
  const ownerFromFlat = String(lead?.assignedToUserName || lead?.assignedToName || '').trim();
  if (ownerFromFlat) return ownerFromFlat;

  const ownerFromNested = `${lead?.assignedTo?.first_name || ''} ${lead?.assignedTo?.last_name || ''}`.trim();
  return ownerFromNested || 'Unassigned';
};

const buildDuplicateLeadInfo = (lead) => {
  const statusName = lead?.status?.status_name || lead?.statusLabel || 'No Status';
  const ownerName = getLeadOwnerName(lead);

  if (isBookedLead(lead)) {
    return `This contact already has a booking.\nStatus: ${statusName} · Owner: ${ownerName}. The booking stays with collection — use this lead to re-engage as a new enquiry.`;
  }

  if (isClosedLostLead(lead)) {
    return `This contact already has a previous lead.\nStatus: ${statusName} · Owner: ${ownerName}. Use this lead to re-engage.`;
  }

  return `This contact already has an active lead.\nStatus: ${statusName} · Owner: ${ownerName}`;
};

const FOLLOW_UP_WORKSPACE_ROLES = ['TC', 'SM', 'SH'];

// Group by options for lead list view
const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'status', label: 'Status' },
  { value: 'source', label: 'Source' },
  { value: 'project', label: 'Project' },
];

const getProjectDisplayName = (project) => {
  const raw = String(project?.project_name || '').trim();
  if (!raw) return '';
  return raw.replace(/\s*\(\d+\)\s*$/, '').trim();
};

const initialNewLead = {
  full_name: '',
  phone: '',
  phone_country_code: '+91',
  alternate_phone_country_code: '+91',
  whatsappSameAsPhone: true,
  whatsapp_number: '',
  alternate_phone: '',
  email: '',
  lead_source_id: '',
  lead_sub_source_id: '',
  project_ids: [],
  project_id: '',
  location_id: '',
  location_ids: [],
  nextFollowUpAt: '',
  lead_status_id: '',
  customerRequirement: '',
  customerTypeId: '',
  motivationType: '',
  svDate: new Date().toISOString().split('T')[0],
  timeSpent: '',
  assignment_mode: 'ME',
  assigned_to: '',
  assignment_mode_manual: false,
  closure_reason_id: '',
  remark: '',
  callResult: 'Answered',
};

const SM_CREATE_STATUS_CODE = 'SV_DONE';

// Follow-ups are date-only — shortcuts resolve to the chosen calendar day.
const toDateOnlyValue = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getQuickFollowUpValue = (dayOffset) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return toDateOnlyValue(date);
};

const toDayStart = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const isFollowUpMissedByDate = (value, referenceDate = new Date()) => {
  const followUpDate = toDayStart(value);
  if (!followUpDate) return false;

  const referenceStart = new Date(referenceDate);
  referenceStart.setHours(0, 0, 0, 0);
  return followUpDate.getTime() < referenceStart.getTime();
};

const getQuickFollowUpForWeekday = (weekday) => {
  const date = new Date();
  const currentDay = date.getDay();
  const dayOffset = (weekday - currentDay + 7) % 7;
  date.setDate(date.getDate() + dayOffset);
  return toDateOnlyValue(date);
};

// Follow-ups are date-only: the minimum selectable value is the start of today.
const getFollowUpMinimumTime = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

// A follow-up date is valid when it is today or later (no time comparison).
const isFollowUpAtLeastMinutesAhead = (value) => {
  const day = toDayStart(value);
  if (!day) return false;
  return day.getTime() >= getFollowUpMinimumTime().getTime();
};

const buildNewLeadFollowUpShortcut = (shortcut) => {
  if (shortcut.kind === 'weekday') {
    return getQuickFollowUpForWeekday(shortcut.weekday, shortcut.hour, shortcut.minute);
  }

  return getQuickFollowUpValue(shortcut.dayOffset, shortcut.hour, shortcut.minute);
};

const SYSTEM_REMARK_PREFIXES = [
  'Lead created with status:',
  'Response:',
  'Quick action:',
  'Follow-up call scheduled for',
  'Action:',
  'Status updated to',
  'Stage changed to',
  'Assigned to',
  'Reassigned to',
  'Site visit',
];
const FOLLOW_UP_SCHEDULED_PREFIX = 'Follow-up call scheduled for';

const MANDATORY_REMARK_STATUS_CODES = new Set([
  'NEW',
  'RNR',
  'FOLLOW_UP',
  'SV_SCHEDULED',
  'SV_DONE',
  'REVISIT',
  'NEGOTIATION_HOT',
  'NEGOTIATION_WARM',
  'NEGOTIATION_COLD',
]);

const isRemarkMandatoryForAction = (action) => {
  if (!action) return false;
  const statusCode = String(action.targetStatusCode || '').trim().toUpperCase();
  return MANDATORY_REMARK_STATUS_CODES.has(statusCode);
};

const normalizeStatusCode = (value) => String(value || '').trim().toUpperCase();

const normalizeStatusKey = (value) => normalizeStatusCode(value).replace(/[\s-]+/g, '_');

const TC_NEW_LEAD_STATUS_ALIASES = {
  NEW: ['NEW', 'FRESH', 'NEW_LEAD'],
  RNR: ['RNR', 'NO_RESPONSE', 'NOT_RESPONDED'],
  FOLLOW_UP: ['FOLLOW_UP', 'FOLLOWUP', 'CALL_BACK', 'CALLBACK'],
  SV_SCHEDULED: ['SV_SCHEDULED', 'SITE_VISIT_SCHEDULED', 'VISIT_SCHEDULED'],
  LOST: ['LOST', 'CLOSED_LOST', 'COLD_LOST'],
  JUNK: ['JUNK'],
  SPAM: ['SPAM'],
};

const TC_STATUS_ALIAS_TO_CANONICAL = Object.entries(TC_NEW_LEAD_STATUS_ALIASES)
  .reduce((acc, [canonical, aliases]) => {
    aliases.forEach((alias) => {
      acc[normalizeStatusKey(alias)] = canonical;
    });
    return acc;
  }, {});

const toCanonicalStatusCode = (statusCode) => {
  const key = normalizeStatusKey(statusCode);
  return TC_STATUS_ALIAS_TO_CANONICAL[key] || key;
};

const isTcAllowedCreateStatus = (statusCode) => {
  const canonical = toCanonicalStatusCode(statusCode);
  return Object.prototype.hasOwnProperty.call(TC_NEW_LEAD_STATUS_ALIASES, canonical);
};

const statusCodeToLabel = (statusCode, workflowConfig) => {
  const normalized = normalizeStatusCode(statusCode);
  if (!normalized) return '';

  if (normalized === 'BOOKED') return 'Booked';

  const statuses = Array.isArray(workflowConfig?.statuses) ? workflowConfig.statuses : [];
  const match = statuses.find((status) => normalizeStatusCode(status?.status_code) === normalized);
  if (match?.status_name) return match.status_name;

  return normalized.replace(/_/g, ' ');
};

const getActionByCode = (workflowConfig, actionCode) => {
  if (!actionCode || !workflowConfig?.actions) return null;
  const actionGroups = Object.values(workflowConfig.actions);
  for (const group of actionGroups) {
    if (!Array.isArray(group)) continue;
    const found = group.find((action) => action?.code === actionCode);
    if (found) return found;
  }
  return null;
};

const getRemarkHistoryStatusLabel = (activity, workflowConfig) => {
  const explicitStatusName = [
    activity?.metadata?.statusName,
    activity?.metadata?.createdStatus,
    activity?.metadata?.targetStatusName,
    activity?.metadata?.newStatusName,
  ].find((value) => typeof value === 'string' && value.trim());
  if (explicitStatusName) return explicitStatusName.trim();

  const fromStatusCode = [
    activity?.metadata?.statusCode,
    activity?.metadata?.targetStatusCode,
    activity?.metadata?.newStatusCode,
  ].find((value) => typeof value === 'string' && value.trim());
  if (fromStatusCode) return statusCodeToLabel(fromStatusCode, workflowConfig);

  if (typeof activity?.title === 'string' && activity.title.startsWith('Status updated to ')) {
    return activity.title.replace('Status updated to ', '').trim();
  }

  const actionCode = activity?.metadata?.actionCode;
  if (actionCode) {
    const action = getActionByCode(workflowConfig, actionCode);
    if (action?.targetStatusCode) {
      return statusCodeToLabel(action.targetStatusCode, workflowConfig);
    }
  }

  return '';
};

const getUserRemarkText = (activity) => {
  if (!activity) return '';

  // 1. Prioritize explicit metadata fields if they exist
  const statusRemark = typeof activity.metadata?.statusRemarkText === 'string'
    ? activity.metadata.statusRemarkText.trim()
    : '';
  if (statusRemark) return statusRemark;

  const note = typeof activity.metadata?.note === 'string' ? activity.metadata.note.trim() : '';
  if (note) return note;

  // 2. Filter out activities that are purely system-level without remarks
  if (['ASSIGNMENT', 'REASSIGNMENT', 'FOLLOW_UP_SCHEDULED'].includes(activity.type)) {
    return '';
  }

  const description = typeof activity.description === 'string' ? activity.description.trim() : '';
  if (!description) return '';

  // 3. Parse the description. 
  const parts = description.split('|').map((part) => part.trim()).filter(Boolean);

  // Check for explicit "remark:" or "note:" labels within the description parts
  const remarkPart = parts.find((part) => /^remark\s*:/i.test(part));
  if (remarkPart) return remarkPart.replace(/^remark\s*:/i, '').trim();

  const notePart = parts.find((part) => /^note\s*:/i.test(part));
  if (notePart) return notePart.replace(/^note\s*:/i, '').trim();

  const noteAddedPart = parts.find((part) => /^note\s*added\s*:/i.test(part));
  if (noteAddedPart) return noteAddedPart.replace(/^note\s*added\s*:/i, '').trim();

  // Filter out parts that are known system messages (case-insensitive)
  const nonSystemParts = parts.filter((part) => (
    !/^action\s*:/i.test(part)
    && !/^response\s*:/i.test(part)
    && !/^call\s*status\s*:/i.test(part)
    && !/^status\s*:/i.test(part)
    && !SYSTEM_REMARK_PREFIXES.some((prefix) => part.toLowerCase().startsWith(prefix.toLowerCase()))
  ));

  if (!nonSystemParts.length) return '';

  const seen = new Set();
  const uniqueParts = nonSystemParts.filter((part) => {
    const normalized = part.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return uniqueParts.join(' | ');
};

const getScheduledFollowUpIso = (activity) => {
  const metadata = activity?.metadata || {};
  const candidates = [
    metadata.nextFollowUpAt,
    metadata.next_follow_up_at,
    metadata.followUpAt,
    metadata.follow_up_at,
    metadata.scheduledFor,
    metadata.scheduled_for,
  ];

  const firstValid = candidates.find((value) => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  });

  return firstValid ? new Date(firstValid).toISOString() : null;
};

// Two dates fall on the same local calendar day.
const isSameLocalDay = (a, b) => (
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

// Convert a follow-up ISO timestamp to the date-only value the follow-up input expects.
const followUpIsoToInputValue = (iso) => (iso ? toDateOnlyValue(new Date(iso)) : '');



const formatActivityDescription = (description, activity) => {
  if (typeof description !== 'string') return '';
  const text = description.trim();

  // Extract any additional info after the follow-up part (e.g. "| remark: ...")
  const pipeIndex = text.indexOf('|');
  const suffix = pipeIndex !== -1 ? text.slice(pipeIndex).trim() : '';

  // If it's a follow-up scheduled activity, format the date part
  if (text.toLowerCase().startsWith(FOLLOW_UP_SCHEDULED_PREFIX.toLowerCase())) {
    const metadataIso = getScheduledFollowUpIso(activity);
    if (metadataIso) {
      const formattedDate = `Next Follow-up: ${formatDateTimeInTimeZone(metadataIso)} IST`;
      return suffix ? `${formattedDate} | ${getUserRemarkText(activity)}` : formattedDate;
    }
  }

  // Otherwise, just return the clean user remark
  return getUserRemarkText(activity);
};

const getAssigneeRoleForAction = (action, workspaceRole) => {
  if (!action) return 'SM';
  if (action.code === 'TC_SV_DONE') return 'SM';
  if (action.code === 'SM_SITE_VISIT') return 'SH';
  if (workspaceRole === 'SM' && action.needsSvDetails) return 'SH';
  if (action.assigneeRole) return action.assigneeRole;
  if (workspaceRole === 'SH') return 'COL';
  if (workspaceRole === 'SM') return 'SH';
  return 'SM';
};

const getClosureReasonCategoryForAction = (action) => {
  if (!action?.needsReason) return null;
  if (action.reasonCategory) return action.reasonCategory;

  switch (action.code) {
    case 'TC_SPAM':
      return 'SPAM';
    case 'TC_JUNK':
      return 'JUNK';
    case 'TC_LOST':
      return 'LOST';
    default:
      return null;
  }
};

const FilterDropdown = ({
  label,
  mobileLabel,
  options,
  selectedValues,
  onToggle,
  onClear,
  isOpen,
  onToggleOpen,
  onClose,
}) => (
  <details className="lead-filter-dropdown" open={isOpen}>
    <summary
      className="lead-filter-dropdown__summary"
      aria-expanded={isOpen}
      onClick={(e) => {
        e.preventDefault();
        onToggleOpen();
      }}
    >
      <span className="hide-mobile">{label}</span>
      <span className="show-mobile">{mobileLabel || label}</span>
      <span className="lead-filter-dropdown__count">{selectedValues.length ? selectedValues.length : 'All'}</span>
    </summary>
    <div className="lead-filter-dropdown__menu">
      <div className="lead-filter-dropdown__menu-head">
        <strong>{label}</strong>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onClear();
            onClose();
          }}
        >
          Clear
        </button>
      </div>
      {!options.length ? (
        <p className="lead-filter-dropdown__empty">No options</p>
      ) : (
        options.map((opt) => (
          <label key={opt.value} className="lead-filter-dropdown__item">
            <input
              type="checkbox"
              checked={selectedValues.includes(opt.value)}
              onChange={() => onToggle(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))
      )}
    </div>
  </details>
);

const LeadWorkspacePage = ({ user, workspaceRole, autoOpenCreate = false, initialTab, prefillPhone = '' }) => {
  const CALL_STATUS_CODES = ['NEW', 'RNR', 'FOLLOW_UP', 'SV_SCHEDULED'];

  const shouldShowCallStatus = (statusCode) => CALL_STATUS_CODES.includes(toCanonicalStatusCode(statusCode));

  const navigate = useNavigate();
  const wsTitle = getWorkspaceTitle(workspaceRole);


  // ── Pipeline config from API ──
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);

  // ── Leads ──
  const [filters, setFilters] = useState({ search: '', stageCode: '', statusCode: '', includeClosed: false });
  const [multiFilters, setMultiFilters] = useState({ stageCodes: [], statusCodes: [], sources: [] });
  const [openFilterKey, setOpenFilterKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  // eslint-disable-next-line no-unused-vars
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1); // last loaded page
  const [pendingMissedCount, setPendingMissedCount] = useState(0); // authoritative overdue count for the Today-tab gate

  // ── Group By ──
  const [groupBy, setGroupBy] = useState('none'); // 'none' | 'status' | 'stage' | 'source'
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());

  // ── Quick Action Popup ──
  const [quickActionLead, setQuickActionLead] = useState(null);
  const [quickActionActivities, setQuickActionActivities] = useState([]);
  const [quickActionLoading, setQuickActionLoading] = useState(false);
  const [quickWorkflowAction, setQuickWorkflowAction] = useState(null);
  const [quickActionSiteVisits, setQuickActionSiteVisits] = useState([]);
  // Voice note recorded with a quick-action remark (SM/SH only). { blob, url, duration }
  const [quickVoice, setQuickVoice] = useState(null);
  const [quickWorkflowForm, setQuickWorkflowForm] = useState({
    note: '',
    statusRemarkText: '',
    nextFollowUpAt: '',
    assignToUserId: '',
    closureReasonId: '',
    reason: '',
    svDate: '',
    svProjectId: '',
    motivationType: '',
    primaryRequirement: '',
    secondaryRequirement: '',
    timeSpent: '',
    callResult: 'Answered',
  });
  const [timeTick, setTimeTick] = useState(() => Date.now());

  // ── Dynamic Status Remarks ──
  const [quickStatusRemarks, setQuickStatusRemarks] = useState([]);
  const [quickRemarkAnsNonAns, setQuickRemarkAnsNonAns] = useState(null); // 'Answered' | 'Not-Answered' | null
  const [quickMissingLocationId, setQuickMissingLocationId] = useState('');
  const [quickMissingProjectIds, setQuickMissingProjectIds] = useState([]);
  const [quickLocationSearch, setQuickLocationSearch] = useState('');
  const [quickProjectSearch, setQuickProjectSearch] = useState('');
  const [quickLocationDropdownOpen, setQuickLocationDropdownOpen] = useState(false);
  const [quickProjectDropdownOpen, setQuickProjectDropdownOpen] = useState(false);
  const [closureReasons, setClosureReasons] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab) return initialTab;
    if (workspaceRole === 'SH') return 'all';
    return 'today';
  }); // 'all' | 'new' | 'today' | 'missed' | 'newhot' | 'reallot' | 'sh_leads' | 'sm_leads'
  const [qaActiveTab, setQaActiveTab] = useState('history'); // 'activity' | 'history'

  // ── Create lead ──
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState(initialNewLead);
  const [projectOptions, setProjectOptions] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [customerTypeOptions, setCustomerTypeOptions] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [motivationOptions, setMotivationOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [subSourceMap, setSubSourceMap] = useState({});
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef(null);
  const toolbarFiltersRef = useRef(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Workflow actions ──
  const [noteDraft, setNoteDraft] = useState('');
  const [actionState, setActionState] = useState({ note: '', nextFollowUpAt: '', assignToUserId: '' });
  const [manualStatus, setManualStatus] = useState('');
  const [manualNextFollowUpAt, setManualNextFollowUpAt] = useState('');
  const [manualUpdateSaving, setManualUpdateSaving] = useState(false);

  // ── Stage Transition Popup ──
  const [stagePopupOpen, setStagePopupOpen] = useState(false);
  const [stagePopupData, setStagePopupData] = useState({ actionCode: '', stageLabel: '', followUpAt: '', reason: '', needsFollowUp: false, callResult: 'Answered' });

  // ── SV Done Modal (TC Handoff) ──
  const [svDoneModalOpen, setSvDoneModalOpen] = useState(false);
  const [svDoneForm, setSvDoneForm] = useState({ assignToUserId: '', svDate: '', svProjectId: '', budgetMin: '', budgetMax: '', note: '' });

  // ── Record Site Visit Modal (SM Analysis) ──
  const [recordSvModalOpen, setRecordSvModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTimeTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [workspaceRole, user?.id]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleOutsideFilterClick = (event) => {
      if (!toolbarFiltersRef.current?.contains(event.target)) {
        setOpenFilterKey(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpenFilterKey(null);
    };

    document.addEventListener('mousedown', handleOutsideFilterClick);
    document.addEventListener('touchstart', handleOutsideFilterClick, { passive: true });
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideFilterClick);
      document.removeEventListener('touchstart', handleOutsideFilterClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);
  const [recordSvForm, setRecordSvForm] = useState({
    svDate: new Date().toISOString().split('T')[0],
    svProjectId: '',
    assignToUserId: '',
    budgetMin: '',
    budgetMax: '',
    motivationType: '',
    primaryRequirement: '',
    secondaryRequirement: '',
    timeSpent: '',
    note: '',
  });

  // ── Closure Reason Modal ──
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [closureModalAction, setClosureModalAction] = useState(null);
  const [closureForm, setClosureForm] = useState({ closureReasonId: '', reason: '' });

  // ── Phone Validation States ──
  const [phoneCheck, setPhoneCheck] = useState({ status: 'idle', leadInfo: null, duplicateLead: null });
  const [altPhoneCheck, setAltPhoneCheck] = useState({ status: 'idle', leadInfo: null, duplicateLead: null });
  const [reengageLeadId, setReengageLeadId] = useState(null);
  const [newLeadStatusRemarks, setNewLeadStatusRemarks] = useState([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [tcMappedLocationIds, setTcMappedLocationIds] = useState([]);
  const [isMappingsLoading, setIsMappingsLoading] = useState(false);

  // ── Customer Profile Modal (SH Close Won) ──
  const [customerProfileOpen, setCustomerProfileOpen] = useState(false);
  const [customerProfileForm, setCustomerProfileForm] = useState({
    buyer_name: '',
    relation_type: '',
    relation_name: '',
    date_of_birth: '', pan_number: '', aadhar_number: '',
    occupation: '', current_post: '', purchase_type: '', marital_status: '',
    current_address: '', current_area: '', current_city: '', current_state: '', current_pincode: '',
    permanent_address: '', permanent_area: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
    sameAsCurrent: false,
    assignToUserId: '', note: '', inventoryUnitId: '', paymentPlanId: '',
    bookingProjectId: '', bookingLocationId: '', bookingPhaseId: '',
    bookingDate: new Date().toISOString().split('T')[0],
  });
  const [availableUnits, setAvailableUnits] = useState([]);
  const [availablePhases, setAvailablePhases] = useState([]);
  const [paymentPlans, setPaymentPlans] = useState([]);

  // ── Assignment ──
  const [assignableUsers, setAssignableUsers] = useState({});
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState({ userId: '', note: '' });

  // ── Derived from config ──
  const stageOptions = useMemo(
    () => buildStageOptions(workflowConfig?.stages || [], workspaceRole),
    [workflowConfig, workspaceRole]
  );

  const statusOptions = useMemo(
    () => buildStatusOptions(workflowConfig?.statuses || []),
    [workflowConfig]
  );

  const roleActions = useMemo(
    () => getActionsForRole(workflowConfig?.actions || {}, workspaceRole),
    [workflowConfig, workspaceRole]
  );

  const stageByCode = useMemo(() => {
    const map = {};
    (workflowConfig?.stages || []).forEach((stage) => {
      map[stage.stage_code] = stage;
    });
    return map;
  }, [workflowConfig]);

  const stageTransitionOptions = useMemo(() => roleActions
    .filter((action) => (
      action.targetStageCode
      && action.targetStageCode !== selectedLead?.stageCode
      && !action.needsAssignee
      && !action.needsReason
      && !action.needsSvDetails
      && !action.needsCustomerProfile
    ))
    .map((action) => {
      const stage = stageByCode[action.targetStageCode];
      return {
        value: action.code,
        actionLabel: action.label,
        stageCode: action.targetStageCode,
        stageLabel: stage?.stage_name || action.targetStageCode,
        needsFollowUp: Boolean(action.needsFollowUp),
      };
    }), [roleActions, selectedLead?.stageCode, stageByCode]);

  const stagePopupAction = useMemo(
    () => roleActions.find((action) => action.code === stagePopupData.actionCode) || null,
    [roleActions, stagePopupData.actionCode]
  );

  const isSmHandoffReadOnlyLead = useCallback((lead) => {
    if (workspaceRole !== 'SM' || !lead || !user?.id) return false;
    const assignedToOtherUser = lead.assignedToUserId && String(lead.assignedToUserId) !== String(user.id);
    return assignedToOtherUser
      && lead.assignedRole === 'SH'
      && lead.previousAssignedTo
      && String(lead.previousAssignedTo) === String(user.id);
  }, [workspaceRole, user?.id]);

  const isShTaggedReadOnlyLead = useCallback((lead) => {
    if (workspaceRole !== 'SH' || !lead || !user?.id) return false;

    const taggedSalesHeadId = lead?.customFields?.assigned_sales_head;
    if (!taggedSalesHeadId || String(taggedSalesHeadId) !== String(user.id)) return false;

    const assignedToMe = lead.assignedToUserId && String(lead.assignedToUserId) === String(user.id);
    return !assignedToMe;
  }, [workspaceRole, user?.id]);

  const isLeadReadOnly = useCallback(
    (lead) => isSmHandoffReadOnlyLead(lead) || isShTaggedReadOnlyLead(lead),
    [isSmHandoffReadOnlyLead, isShTaggedReadOnlyLead]
  );

  const selectedLeadReadOnly = useMemo(
    () => isLeadReadOnly(selectedLead),
    [isLeadReadOnly, selectedLead]
  );

  const quickActionLeadReadOnly = useMemo(
    () => isLeadReadOnly(quickActionLead),
    [isLeadReadOnly, quickActionLead]
  );

  const quickWorkflowIsTerminalAction = useMemo(
    () => ['TC_JUNK', 'TC_SPAM', 'TC_LOST', 'SM_LOST', 'COL_CANCELLED'].includes(quickWorkflowAction?.code),
    [quickWorkflowAction]
  );

  const quickWorkflowIsRnrAction = useMemo(
    () => quickWorkflowAction?.targetStatusCode === 'RNR' || quickWorkflowAction?.code?.includes('RNR'),
    [quickWorkflowAction]
  );

  const quickWorkflowNeedsMissingLocationProject = useMemo(
    () => workspaceRole === 'TC' && Boolean(quickWorkflowAction) && !quickWorkflowIsTerminalAction && !quickWorkflowIsRnrAction,
    [workspaceRole, quickWorkflowAction, quickWorkflowIsTerminalAction, quickWorkflowIsRnrAction]
  );

  const quickLeadHasLocation = useMemo(
    () => {
      const locId = quickActionLead?.locationId;
      const intLocs = (quickActionLead?.interestedLocations || []).filter(id => id && String(id).trim() !== '');
      return Boolean(locId || intLocs.length > 0);
    },
    [quickActionLead]
  );

  const quickLeadHasProject = useMemo(
    () => {
      const projId = quickActionLead?.projectId;
      const intProjs = (quickActionLead?.interestedProjects || []).filter(id => id && String(id).trim() !== '');
      return Boolean(projId || intProjs.length > 0);
    },
    [quickActionLead]
  );

  const selectedLeadHasLocation = useMemo(
    () => Boolean(
      selectedLead?.interestedLocations?.length
      || selectedLead?.locationId
      || selectedLead?.location
      || quickMissingLocationId
    ),
    [selectedLead, quickMissingLocationId]
  );

  const selectedLeadHasProject = useMemo(
    () => Boolean(
      selectedLead?.interestedProjects?.length
      || selectedLead?.projectId
      || selectedLead?.project
      || quickMissingProjectIds?.length > 0
    ),
    [selectedLead, quickMissingProjectIds]
  );

  // Variant that only checks whether the lead already has a project (ignores quick picks)
  const selectedLeadHasProjectFromLead = useMemo(
    () => Boolean(
      selectedLead?.interestedProjects?.length
      || selectedLead?.projectId
      || selectedLead?.project
    ),
    [selectedLead]
  );

  const quickMissingProjectOptions = useMemo(
    () => {
      const activeLocId = quickWorkflowForm.locationId || quickMissingLocationId;
      if (!activeLocId) return projectOptions;
      return projectOptions.filter((project) => {
        const projectLocationId = project.location_id || project.locationId || '';
        return String(projectLocationId) === String(activeLocId);
      });
    },
    [projectOptions, quickWorkflowForm.locationId, quickMissingLocationId]
  );

  const toolbarStageOptions = useMemo(() => {
    if (workspaceRole === 'SM') {
      return stageOptions.filter((o) => ['SITE_VISIT', 'OPPORTUNITY'].includes(o.value));
    }
    if (workspaceRole === 'SH') {
      return stageOptions.filter((o) => ['OPPORTUNITY', 'BOOKING'].includes(o.value));
    }
    return stageOptions.filter((o) => ['LEAD', 'CONTACTED', 'QUALIFIED'].includes(o.value));
  }, [workspaceRole, stageOptions]);

  const toolbarStatusOptions = useMemo(() => (
    workspaceRole === 'TC'
      ? statusOptions.filter((opt) => ['NEW', 'RNR', 'FOLLOW_UP', 'SV_SCHEDULED'].includes(opt.value))
      : statusOptions
  ), [workspaceRole, statusOptions]);

  const sourceFilterOptions = useMemo(() => {
    const sourceSet = new Set();

    sourceOptions.forEach((s) => {
      const name = (s?.source_name || s?.name || '').trim();
      if (name) sourceSet.add(name);
    });

    leads.forEach((l) => {
      const name = (l?.source || '').trim();
      if (name) sourceSet.add(name);
    });

    return Array.from(sourceSet)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name.toLowerCase(), label: name }));
  }, [sourceOptions, leads]);

  const filteredLeads = useMemo(() => {
    const searchText = (filters.search || '').trim().toLowerCase();
    const useFollowUpTabs = FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole);

    return leads.filter((lead) => {
      // Cross-role read-only tab filtering (client-side only — these tabs don't use server-side followUpFilter)
      if (useFollowUpTabs) {
        const isSmReadOnlyLead = workspaceRole === 'SM' && isSmHandoffReadOnlyLead(lead);
        const isShReadOnlyLead = workspaceRole === 'SH' && isShTaggedReadOnlyLead(lead);
        const isCrossRoleReadOnlyLead = isSmReadOnlyLead || isShReadOnlyLead;

        if (workspaceRole === 'SM' && activeTab === 'sh_leads') {
          if (!isSmReadOnlyLead) return false;
        } else if (workspaceRole === 'SH' && activeTab === 'sm_leads') {
          if (!isShReadOnlyLead) return false;
        } else {
          // Today/Missed/New tabs must never mix in cross-role read-only leads.
          if (isCrossRoleReadOnlyLead) return false;
        }
      }

      // Client-side text search for instant feedback (server also filters, but this is snappier)
      if (searchText) {
        const haystack = [
          lead.fullName,
          lead.phone,
          lead.email,
          lead.leadNumber,
          lead.source,
          lead.subSource,
          lead.project,
          lead.location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(searchText)) return false;
      }

      return true;
    });
  }, [leads, filters.search, activeTab, workspaceRole, isSmHandoffReadOnlyLead, isShTaggedReadOnlyLead]);

  // ── Group leads by selected field (status/stage/source/project) ──
  const groupedLeads = useMemo(() => {
    if (groupBy === 'none') return null;
    
    const groups = {};
    filteredLeads.forEach((lead) => {
      let key;
      switch (groupBy) {
        case 'status':
          key = lead.statusLabel || lead.statusName || lead.status || 'Unknown';
          break;
        case 'source':
          key = lead.source || 'Unknown';
          break;
        case 'project':
          // Get project name from interestedProjects array or project field
          if (lead.interestedProjects?.length > 0) {
            const projNames = lead.interestedProjects
              .map((pid) => projectOptions.find((p) => p.id === pid)?.project_name)
              .filter(Boolean);
            key = projNames.length > 0 ? projNames.join(', ') : (lead.project || 'No Project');
          } else {
            key = lead.project || 'No Project';
          }
          break;
        default:
          key = 'Unknown';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(lead);
    });
    
    // Sort groups alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredLeads, groupBy, projectOptions]);

  // Toggle group collapse state
  const toggleGroup = (groupKey) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const selectedSourceSubSources = useMemo(
    () => subSourceMap[newLeadForm.lead_source_id] || [],
    [subSourceMap, newLeadForm.lead_source_id]
  );

  const newLeadStatusChipOptions = useMemo(() => {
    if (!Array.isArray(statusOptions) || statusOptions.length === 0) return [];

    if (workspaceRole === 'TC') {
      const filtered = statusOptions.filter((st) => isTcAllowedCreateStatus(st.value));
      return filtered.length >= 3 ? filtered : statusOptions;
    }

    if (workspaceRole === 'SM') {
      const filtered = statusOptions.filter((st) => toCanonicalStatusCode(st.value) === SM_CREATE_STATUS_CODE);
      if (filtered.length > 0) return filtered;
      return [{ value: SM_CREATE_STATUS_CODE, label: 'SV Done', category: 'ACTIVE', isTerminal: false }];
    }

    const actionStatusCodes = new Set(
      roleActions
        .map((action) => action?.targetStatusCode)
        .filter(Boolean)
        .map((code) => String(code).toUpperCase())
    );

    if (!actionStatusCodes.size) return statusOptions;

    actionStatusCodes.add('NEW');

    const filtered = statusOptions.filter((st) => actionStatusCodes.has(String(st.value || '').toUpperCase()));
    return filtered.length > 0 ? filtered : statusOptions;
  }, [workspaceRole, roleActions, statusOptions]);

  const selectedNewLeadStatusCode = useMemo(() => {
    const selected = statusOptions.find((s) => s.id === newLeadForm.lead_status_id || s.value === newLeadForm.lead_status_id);
    return toCanonicalStatusCode(selected?.value || newLeadForm.lead_status_id || '');
  }, [statusOptions, newLeadForm.lead_status_id]);

  const selectedCreateLocationIds = useMemo(() => {
    const ids = [
      ...(Array.isArray(newLeadForm.location_ids) ? newLeadForm.location_ids : []),
      newLeadForm.location_id,
    ]
      .filter(Boolean)
      .map((id) => String(id));
    return [...new Set(ids)];
  }, [newLeadForm.location_ids, newLeadForm.location_id]);

  const tcCanSelfAssignSelectedLocation = useMemo(() => {
    if (workspaceRole !== 'TC') return true;
    if (isMappingsLoading) return true; // Default to true while loading to avoid premature pool-flip
    if (!selectedCreateLocationIds.length) return true;
    if (!tcMappedLocationIds.length) return false;

    const mapped = new Set(tcMappedLocationIds.map((id) => String(id)));
    return selectedCreateLocationIds.some((id) => mapped.has(String(id)));
  }, [workspaceRole, selectedCreateLocationIds, tcMappedLocationIds, isMappingsLoading]);

  const tcStatusNeedsFullDetails = ['NEW', 'FOLLOW_UP', 'SV_SCHEDULED'].includes(selectedNewLeadStatusCode);
  const tcStatusNeedsFollowUp = ['NEW', 'FOLLOW_UP', 'SV_SCHEDULED', 'RNR'].includes(selectedNewLeadStatusCode);
  const isTerminalCreateStatus = ['LOST', 'JUNK', 'SPAM', 'COLD_LOST'].includes(selectedNewLeadStatusCode);
  const needsRemark = Boolean(selectedNewLeadStatusCode) && selectedNewLeadStatusCode !== 'NEW';
  const smStatusNeedsFollowUp = workspaceRole === 'SM' && false;
  const smStatusNeedsReason = workspaceRole === 'SM' && selectedNewLeadStatusCode === 'LOST';
  const smStatusNeedsAssignee = false; // SM/SH leads are now automatically self-assigned as per user request
  const smStatusNeedsCallStatus = workspaceRole === 'SM' && false;
  const smStatusNeedsRemark = workspaceRole === 'SM' && false;
  const createLeadNeedsRemark = workspaceRole === 'SM' ? smStatusNeedsRemark : needsRemark;
  const shouldShowCreateCallStatus = workspaceRole === 'SM'
    ? smStatusNeedsCallStatus
    : shouldShowCallStatus(selectedNewLeadStatusCode);

  const newLeadFollowUpShortcutOptions = useMemo(() => {
    // Follow-ups are date-only: keep shortcuts whose day is today or later.
    const todayStart = toDayStart(new Date(timeTick))?.getTime() ?? 0;
    return NEW_LEAD_FOLLOW_UP_SHORTCUTS
      .map((shortcut) => ({
        ...shortcut,
        value: buildNewLeadFollowUpShortcut(shortcut),
      }))
      .filter((shortcut) => {
        const shortcutDay = toDayStart(shortcut.value)?.getTime();
        return Number.isFinite(shortcutDay) && shortcutDay >= todayStart;
      });
  }, [timeTick]);

  const newLeadValidation = useMemo(() => {
    const errors = [];
    const primaryPhone = sanitizePhoneNumberInput(newLeadForm.phone);
    const alternatePhone = sanitizePhoneNumberInput(newLeadForm.alternate_phone);
    const whatsappPhone = sanitizePhoneNumberInput(newLeadForm.whatsapp_number);

    if (!newLeadForm.full_name?.trim()) errors.push('Full name is required');
    if (!isValidPhoneForCountry(newLeadForm.phone_country_code, primaryPhone)) {
      errors.push('Enter a valid phone number for the selected country');
    }

    if (alternatePhone && !isValidPhoneForCountry(newLeadForm.alternate_phone_country_code, alternatePhone)) {
      errors.push('Enter a valid alternate phone number for the selected country');
    }

    if (!newLeadForm.whatsappSameAsPhone && whatsappPhone && !isValidPhoneForCountry(newLeadForm.phone_country_code, whatsappPhone)) {
      errors.push('Enter a valid WhatsApp number for the selected country');
    }

    if (newLeadForm.email?.trim() && !EMAIL_REGEX.test(newLeadForm.email.trim())) {
      errors.push('Please enter a valid email address');
    }

    if (!newLeadForm.lead_source_id) errors.push('Lead source is required');

    const hasSubSourcesAvailable = selectedSourceSubSources.length > 0;
    if (workspaceRole === 'TC' || (workspaceRole === 'SM' && hasSubSourcesAvailable)) {
      if (!newLeadForm.lead_sub_source_id) errors.push('Lead sub-source is required');
    }
    if (workspaceRole === 'TC') {
      if (!newLeadForm.lead_status_id) errors.push('Lead status is required');

      if (tcStatusNeedsFullDetails) {
        if (!newLeadForm.location_id) errors.push('Location is required');
        if (!newLeadForm.project_ids?.length) errors.push('At least one project is required');
        if (!newLeadForm.callResult) errors.push('Call status is required');
      }

      if (tcStatusNeedsFollowUp && !newLeadForm.nextFollowUpAt) {
        errors.push('Next follow up date is required');
      }

      if (needsRemark && !newLeadForm.remark?.trim()) {
        errors.push('Notes & Remarks are required');
      }

      if (newLeadForm.nextFollowUpAt && !isFollowUpAtLeastMinutesAhead(newLeadForm.nextFollowUpAt)) {
        errors.push('Next follow up must be at least 5 minutes from now');
      }
      {
        const capError = followUpLimitError(newLeadForm.nextFollowUpAt, selectedNewLeadStatusCode);
        if (capError) errors.push(capError);
      }

      if (isTerminalCreateStatus) {
        if (!newLeadForm.closure_reason_id) errors.push('Closure reason is required');
      }
    }

    if (workspaceRole === 'SM') {
      if (!newLeadForm.lead_status_id) errors.push('Lead status is required');
      if (selectedNewLeadStatusCode && selectedNewLeadStatusCode !== SM_CREATE_STATUS_CODE) {
        errors.push('Sales Manager can create leads only with SV Done status');
      }
      if (!newLeadForm.location_id) errors.push('Location is required');
      if (!newLeadForm.project_ids?.length) errors.push('At least one project is required');

      if (smStatusNeedsFollowUp && !newLeadForm.nextFollowUpAt) {
        errors.push('Next follow up date is required');
      }

      if (smStatusNeedsReason && !newLeadForm.closure_reason_id) {
        errors.push('Closure reason is required');
      }

      if (smStatusNeedsAssignee && !newLeadForm.assigned_to) {
        errors.push('Sales Head is required for Negotiation (Hot)');
      }

      if (smStatusNeedsCallStatus && !newLeadForm.callResult) {
        errors.push('Call status is required');
      }

      if (smStatusNeedsRemark && !newLeadForm.remark?.trim()) {
        errors.push('Notes & Remarks are required');
      }

      if (newLeadForm.nextFollowUpAt && !isFollowUpAtLeastMinutesAhead(newLeadForm.nextFollowUpAt)) {
        errors.push('Next follow up must be at least 5 minutes from now');
      }
      {
        const capError = followUpLimitError(newLeadForm.nextFollowUpAt, selectedNewLeadStatusCode);
        if (capError) errors.push(capError);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        primaryPhone: buildE164Phone(newLeadForm.phone_country_code, primaryPhone),
        alternatePhone: alternatePhone ? buildE164Phone(newLeadForm.alternate_phone_country_code, alternatePhone) : '',
        whatsappPhone: newLeadForm.whatsappSameAsPhone
          ? buildE164Phone(newLeadForm.phone_country_code, primaryPhone)
          : (whatsappPhone ? buildE164Phone(newLeadForm.phone_country_code, whatsappPhone) : ''),
      },
    };
  }, [
    newLeadForm,
    workspaceRole,
    tcStatusNeedsFullDetails,
    tcStatusNeedsFollowUp,
    isTerminalCreateStatus,
    needsRemark,
    smStatusNeedsFollowUp,
    smStatusNeedsReason,
    smStatusNeedsAssignee,
    smStatusNeedsCallStatus,
    smStatusNeedsRemark,
    selectedNewLeadStatusCode,
    selectedSourceSubSources,
  ]);

  // ── Stats (Telecaller KPI cards) ──
  const computedStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const totalLeads = leads.length;
    const newToday = leads.filter((l) => l.createdAt && new Date(l.createdAt) >= todayStart).length;
    const todayFollowUps = leads.filter((l) => l.nextFollowUpAt && toDayStart(l.nextFollowUpAt)?.getTime() === todayStart.getTime() && !l.isClosed).length;
    const overdueFollowUps = leads.filter((l) => l.nextFollowUpAt && isFollowUpMissedByDate(l.nextFollowUpAt, todayStart) && !l.isClosed).length;

    const svScheduled = leads.filter((l) => {
      const sStage = String(l.stageCode || '').toUpperCase();
      const sStatus = String(l.statusCode || '').toUpperCase();
      return sStage.includes('SV_SCHED') || sStatus.includes('SV_SCHED') || sStatus === 'SV_SCHEDULED';
    }).length;

    const svCompleted = leads.filter((l) => {
      const sStage = String(l.stageCode || '').toUpperCase();
      const sStatus = String(l.statusCode || '').toUpperCase();
      return sStage.includes('SV_DONE') || sStage.includes('SV_COMPLET') || sStatus.includes('SV_DONE') || sStatus.includes('SV_COMPLET');
    }).length;

    const missedFollowups = overdueFollowUps;
    return { totalLeads, newToday, todayFollowUps, overdueFollowUps, svScheduled, svCompleted, missedFollowups };
  }, [leads]);

  // Whether the current user still has overdue follow-ups. Driven by an authoritative server
  // count (refreshed in loadLeads) rather than the loaded page, so the Today-tab gate stays
  // correct even when the overdue leads sit beyond the first page.
  const hasPendingMissedFollowupsForMe =
    FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && pendingMissedCount > 0;

  // ── Load workflow config on mount ──
  const loadWorkflowConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const resp = await leadWorkflowApi.getWorkflowConfig();
      setWorkflowConfig(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load workflow config'));
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflowConfig();
  }, [loadWorkflowConfig]);

  useEffect(() => {
    const loadTcMappedLocations = async () => {
      if (workspaceRole !== 'TC' || !user?.id) {
        setTcMappedLocationIds([]);
        return;
      }

      setIsMappingsLoading(true);
      try {
        const response = await leadWorkflowApi.getMyMappedLocations();
        const locationIds = response?.data?.location_ids || [];
        const normalized = [...new Set(locationIds.filter(Boolean).map((id) => String(id)))];
        setTcMappedLocationIds(normalized);
      } catch (err) {
        console.error('Failed to load TC mapped locations:', err);
        setTcMappedLocationIds([]);
      } finally {
        setIsMappingsLoading(false);
      }
    };

    loadTcMappedLocations();
  }, [workspaceRole, user?.id]);

  useEffect(() => {
    if (workspaceRole !== 'TC') return;
    if (tcCanSelfAssignSelectedLocation) return;

    setNewLeadForm((prev) => {
      if (prev.assignment_mode === 'POOL' && !prev.assigned_to) return prev;
      return { ...prev, assignment_mode: 'POOL', assigned_to: '', assignment_mode_manual: false };
    });
  }, [workspaceRole, tcCanSelfAssignSelectedLocation]);

  useEffect(() => {
    if (workspaceRole !== 'TC' || isMappingsLoading) return;
    if (selectedNewLeadStatusCode === 'RNR') return;
    if (!selectedCreateLocationIds.length) return;
    if (newLeadForm.assignment_mode_manual) return;

    setNewLeadForm((prev) => {
      if (!tcCanSelfAssignSelectedLocation) {
        if (prev.assignment_mode === 'POOL' && !prev.assigned_to) return prev;
        return { ...prev, assignment_mode: 'POOL', assigned_to: '', assignment_mode_manual: false };
      }

      if (prev.assignment_mode === 'ME' && String(prev.assigned_to || '') === String(user?.id || '')) return prev;
      return { ...prev, assignment_mode: 'ME', assigned_to: user?.id || '', assignment_mode_manual: false };
    });
  }, [workspaceRole, selectedNewLeadStatusCode, selectedCreateLocationIds, tcCanSelfAssignSelectedLocation, user?.id, isMappingsLoading, newLeadForm.assignment_mode_manual]);

  // ── Load assignable users for roles that need them ──
  const loadAssignableUsers = useCallback(async (roleCode) => {
    if (assignableUsers[roleCode]) return;
    try {
      const resp = await leadWorkflowApi.getAssignableUsers(roleCode);
      setAssignableUsers((prev) => ({ ...prev, [roleCode]: resp.data || [] }));
    } catch {
      // silently fail
    }
  }, [assignableUsers]);

  // Pre-load assignable users for relevant handoff roles
  useEffect(() => {
    if (workspaceRole === 'TC') {
      loadAssignableUsers('SM');
      loadAssignableUsers('TC');
    }
    if (workspaceRole === 'SM') loadAssignableUsers('SH');
    if (workspaceRole === 'SH') loadAssignableUsers('COL');
  }, [workspaceRole, loadAssignableUsers]);

  // ── Load leads ──
  const loadLeads = useCallback(async ({ silent = false, page: requestedPage } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    // Use requested page or default to 1 for fresh loads
    const targetPage = requestedPage || 1;

    try {
      // Build query params based on active tab
      const queryParams = {
        roleCode: workspaceRole,
        page: targetPage,
        limit: 100,
        timezoneOffset: new Date().getTimezoneOffset(),
        ...filters,
      };

      // Send multi-filters server-side (comma-separated)
      if (multiFilters.stageCodes.length) {
        queryParams.stageCodes = multiFilters.stageCodes.join(',');
      }
      if (multiFilters.statusCodes.length) {
        queryParams.statusCodes = multiFilters.statusCodes.join(',');
      }
      if (multiFilters.sources.length) {
        queryParams.sources = multiFilters.sources.join(',');
      }

      // Add tab-specific filters for follow-up roles
      if (FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole)) {
        if (activeTab === 'new') {
          queryParams.unassigned = true;
        } else if ((workspaceRole === 'SM' && activeTab === 'sh_leads') || (workspaceRole === 'SH' && activeTab === 'sm_leads')) {
          // Keep role visibility broad for cross-role read-only tabs; filtering is handled client-side.
        } else if (activeTab === 'newhot') {
          // New/Hot: fresh marketing-API leads + re-enquired leads assigned to
          // this user, flagged until their first update. Membership is
          // flag-based (active AND inactive leads both show).
          queryParams.assignedToMe = true;
          queryParams.newHot = true;
        } else if (activeTab === 'reallot') {
          // Reallot: this user's leads sitting in the Reallot status.
          queryParams.assignedToMe = true;
          queryParams.statusCode = 'REALLOT';
        } else if (workspaceRole === 'SH' && activeTab === 'booked') {
          // Booked: this SH's leads currently in the BOOKING stage. These are
          // hidden from the working list, so the server exposes them only via the
          // booked flag. The SH can view the booking or re-book the same lead.
          queryParams.assignedToMe = true;
          queryParams.booked = true;
        } else {
          // Assigned lead tabs (today / missed) — only show leads assigned to this user
          queryParams.assignedToMe = true;
          // Date-only server-side follow-up filter — no time component, no off-by-one
          if (!filters.search) {
            if (activeTab === 'today') {
              queryParams.followUpFilter = 'today';
            } else if (activeTab === 'missed') {
              queryParams.followUpFilter = 'missed';
            }
          }
        }
      }

      const resp = await leadWorkflowApi.getLeads(queryParams);

      const data = resp.data || [];
      pageRef.current = targetPage;

      setLeads(data);
      setMeta(resp.meta || { total: data.length, page: targetPage, totalPages: 1 });

      // Selection housekeeping
      const selectedExists = data.some((l) => l.id === selectedLeadId);
      if (selectedLeadId && !selectedExists) {
        setSelectedLeadId(null);
      }
      if (!data.length) {
        setSelectedLeadId(null);
      }

      // Refresh the authoritative count of MY overdue follow-ups using date-only filter.
      // The Today-tab action button stays disabled until this reaches zero.
      if (FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole)) {
        leadWorkflowApi.getLeads({
          roleCode: workspaceRole,
          assignedToMe: true,
          followUpFilter: 'missed',
          timezoneOffset: new Date().getTimezoneOffset(),
          page: 1,
          limit: 1,
        })
          .then((r) => setPendingMissedCount(r.meta?.total ?? 0))
          .catch(() => { /* keep last known count on error */ });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load leads'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [filters, multiFilters, workspaceRole, selectedLeadId, activeTab]);

  // Load closure reasons for new lead form when a terminal status is selected
  useEffect(() => {
    if (!newLeadOpen || !newLeadForm.lead_status_id) return;

    const selectedStatus = statusOptions.find(st => st.id === newLeadForm.lead_status_id || st.value === newLeadForm.lead_status_id);
    if (!selectedStatus) return;

    let category = null;
    if (selectedStatus.value === 'LOST') category = 'COLD';
    if (selectedStatus.value === 'JUNK') category = 'JUNK';
    if (selectedStatus.value === 'SPAM') category = 'SPAM';

    if (category) {
      const fetchReasons = async () => {
        try {
          const resp = await leadWorkflowApi.getClosureReasons(category);
          setClosureReasons(resp.data?.rows || resp.data || []);
        } catch {
          setClosureReasons([]);
        }
      };
      fetchReasons();
    } else {
      setClosureReasons([]);
    }
  }, [newLeadOpen, newLeadForm.lead_status_id, statusOptions]);

  // Fetch status-specific remarks for New Lead creation chips
  useEffect(() => {
    if (!newLeadOpen || !newLeadForm.lead_status_id) {
      setNewLeadStatusRemarks([]);
      return;
    }

    const fetchRemarks = async () => {
      setRemarksLoading(true);
      try {
        // Try to find status object to get code
        const statusObj = statusOptions.find(st => st.id === newLeadForm.lead_status_id || st.value === newLeadForm.lead_status_id);
        if (!statusObj) {
          setRemarksLoading(false);
          return;
        }

        const resp = await statusRemarkApi.getByStatusCode(statusObj.value);
        // Correctly extract the remarks array from the response object
        setNewLeadStatusRemarks(resp.data?.remarks || resp.data || []);
      } catch (err) {
        console.error('Failed to fetch new lead status remarks:', err);
        setNewLeadStatusRemarks([]);
      } finally {
        setRemarksLoading(false);
      }
    };

    fetchRemarks();
  }, [newLeadOpen, newLeadForm.lead_status_id, statusOptions]);

  // ── Duplicate Phone Check ──
  const checkDuplicatePhone = async (phone, type, countryCode = '+91') => {
    const digits = sanitizePhoneNumberInput(phone);

    // Only look up duplicates once the number is a complete, valid phone for the
    // selected country. A fixed length gate (e.g. >= 9) wrongly skipped shorter
    // national numbers such as Kuwait's 8-digit mobiles, so they never got the
    // "Valid" confirmation or a duplicate check.
    if (!isValidPhoneForCountry(countryCode, phone)) {
      if (type === 'primary') setPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
      else setAltPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
      return;
    }

    if (type === 'primary') setPhoneCheck({ status: 'checking', leadInfo: null, duplicateLead: null });
    else setAltPhoneCheck({ status: 'checking', leadInfo: null, duplicateLead: null });

    try {
      const resp = await leadWorkflowApi.searchLeadByPhone(digits, countryCode);
      const results = resp.data || [];
      const exactMatch = results.find((l) => {
        const candidatePhones = [
          l.phone,
          l.alternate_phone,
          l.alternatePhone,
          l.whatsapp_number,
          l.whatsappNumber,
          l.secondary_phone_1,
          l.secondaryPhone1,
          l.secondary_phone_2,
          l.secondaryPhone2,
          l.secondary_phone_3,
          l.secondaryPhone3,
        ];
        return candidatePhones.some((num) => phoneMatchesAcrossCountryCode(num, digits, countryCode));
      });

      const matchedLead = exactMatch || null;

      if (matchedLead) {
        // Fetch complete lead details
        try {
          const detailResp = await leadWorkflowApi.getLeadById(matchedLead.id);
          const fullLead = detailResp?.data || matchedLead;
          const info = buildDuplicateLeadInfo(fullLead);
          if (type === 'primary') setPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: fullLead });
          else setAltPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: fullLead });
        } catch {
          // Fallback: use search result only
          const info = buildDuplicateLeadInfo(matchedLead);
          if (type === 'primary') setPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: matchedLead });
          else setAltPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: matchedLead });
        }
      } else {
        if (type === 'primary') setPhoneCheck({ status: 'valid', leadInfo: null, duplicateLead: null });
        else setAltPhoneCheck({ status: 'valid', leadInfo: null, duplicateLead: null });
      }
    } catch {
      if (type === 'primary') setPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
      else setAltPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
    }
  };

  // Populate form with duplicate lead details
  const prefillFormFromDuplicateLead = useCallback((lead) => {
    if (!lead) return;
    if (!isClosedLostLead(lead)) {
      toast.error(`New lead cannot be created. Existing lead is active with owner ${getLeadOwnerName(lead)}.`);
      return;
    }

    const fullName = (
      lead.fullName
      || lead.full_name
      || `${lead.firstName || lead.first_name || ''} ${lead.lastName || lead.last_name || ''}`.trim()
    ).trim();
    const leadPhone = lead.phone || lead.phone_number || lead.mobile || '';
    const leadEmail = lead.email || '';

    // The stored phone is an E.164-style number that may or may not keep its
    // leading '+'. Detect the real country from the full number (via
    // libphonenumber) so re-engaging an international lead doesn't reset the
    // country to +91 and push the country code into the national part. Falls
    // back to +91 for a bare national number that carries no country code.
    const rawStr = String(leadPhone).trim();
    const rawDigits = sanitizePhoneNumberInput(rawStr);
    let countryCode = '+91';
    let phoneDigits = rawDigits;
    if (rawDigits) {
      let parsed = null;
      try {
        parsed = parsePhoneNumberFromString(rawStr.startsWith('+') ? rawStr : `+${rawDigits}`);
      } catch { parsed = null; }
      if (parsed && parsed.isValid()) {
        countryCode = `+${parsed.countryCallingCode}`;
        phoneDigits = parsed.nationalNumber;
      } else if (rawStr.startsWith('+')) {
        // Explicitly international but not fully valid (e.g. a malformed stored
        // number) — still keep its country code by longest-prefix match.
        const found = [...COUNTRY_CODES]
          .sort((a, b) => b.value.length - a.value.length)
          .find((c) => rawStr.startsWith(c.value));
        if (found) {
          countryCode = found.value;
          phoneDigits = sanitizePhoneNumberInput(rawStr.slice(found.value.length));
        }
      }
    }

    setNewLeadForm((prev) => ({
      ...prev,
      full_name: fullName || prev.full_name,
      phone: sanitizePhoneNumberInput(phoneDigits) || prev.phone,
      phone_country_code: countryCode,
      alternate_phone_country_code: countryCode,
      email: leadEmail || prev.email,
    }));

    setReengageLeadId(lead.id || null);

    toast.success('Form pre-filled with duplicate lead details');
  }, []);

  useEffect(() => {
    if (!reengageLeadId) return;
    const currentDuplicateIds = [phoneCheck.duplicateLead?.id, altPhoneCheck.duplicateLead?.id].filter(Boolean);
    if (!currentDuplicateIds.includes(reengageLeadId)) {
      setReengageLeadId(null);
    }
  }, [reengageLeadId, phoneCheck.duplicateLead, altPhoneCheck.duplicateLead]);


  useEffect(() => {
    const timer = setTimeout(() => {
      checkDuplicatePhone(newLeadForm.phone, 'primary', newLeadForm.phone_country_code);
    }, 600);
    return () => clearTimeout(timer);
  }, [newLeadForm.phone, newLeadForm.phone_country_code]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkDuplicatePhone(newLeadForm.alternate_phone, 'alt', newLeadForm.alternate_phone_country_code);
    }, 600);
    return () => clearTimeout(timer);
  }, [newLeadForm.alternate_phone, newLeadForm.alternate_phone_country_code]);

  // ── Load lead detail ──
  const loadLeadDetail = useCallback(async (leadId) => {
    if (!leadId) { setSelectedLead(null); return; }
    try {
      const resp = await leadWorkflowApi.getLeadById(leadId);
      setSelectedLead(resp.data || null);
      setManualStatus(resp.data?.statusCode || '');
      setManualNextFollowUpAt(resp.data?.nextFollowUpAt ? toDateOnlyValue(new Date(resp.data.nextFollowUpAt)) : '');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load lead details'));
      setSelectedLead(null);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadLeads(); }, [filters, multiFilters, workspaceRole, activeTab]);
  useEffect(() => { loadLeadDetail(selectedLeadId); }, [selectedLeadId, loadLeadDetail]);


  const toggleMultiFilter = (key, value) => {
    setMultiFilters((prev) => {
      const existing = prev[key] || [];
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      return { ...prev, [key]: next };
    });
  };

  const [expandedLeadIds, setExpandedLeadIds] = useState(new Set());

  const toggleExpandLead = (leadId) => {
    setExpandedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const clearMultiFilters = () => {
    setMultiFilters({ stageCodes: [], statusCodes: [], sources: [] });
    setFilters((prev) => ({ ...prev, search: '' }));
    setOpenFilterKey(null);
  };

  // ── Create lead options ──
  const loadCreateOptions = async () => {
    if (createOptionsLoading) return;
    setCreateOptionsLoading(true);
    try {
      // Each dropdown is fetched independently. A plain Promise.all here meant a
      // single 403 (e.g. no access to Customer Types) rejected the whole batch and
      // left EVERY dropdown empty — the Location picker looked broken because an
      // unrelated master call had failed. One missing list must not blank the form.
      const settle = (p) => p.then((r) => r).catch(() => ({ data: [] }));
      const [pResp, ctResp, motResp, lResp, sResp] = await Promise.all([
        settle(projectApi.getDropdown()),
        settle(customerTypeApi.getDropdown()),
        settle(motivationApi.getDropdown()),
        settle(locationApi.getDropdown()),
        settle(leadSourceApi.getWithSubSources().catch(() => leadSourceApi.getDropdown())),
      ]);
      const projects = pResp.data || [];
      const customerTypes = ctResp.data || [];
      const motivations = motResp.data || [];
      const locations = lResp.data || [];
      const sources = sResp.data || [];
      const normalizedSourceName = (source) => String(source?.source_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const filteredSources = workspaceRole === 'SM'
        ? sources.filter((source) => ['walkin', 'others', 'other'].includes(normalizedSourceName(source)))
        : sources;
      const map = {};
      filteredSources.forEach((s) => { map[s.id] = s.subSources || []; });

      if (Object.values(map).every((v) => v.length === 0)) {
        await Promise.all(filteredSources.map(async (s) => {
          try {
            const sub = await leadSubSourceApi.getBySource(s.id);
            map[s.id] = sub.data || [];
          } catch { map[s.id] = []; }
        }));
      }

      setProjectOptions(projects);
      setCustomerTypeOptions(customerTypes);
      setMotivationOptions(motivations);
      setLocationOptions(locations);
      setSourceOptions(filteredSources);
      setSubSourceMap(map);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load options'));
    } finally {
      setCreateOptionsLoading(false);
    }
  };

  useEffect(() => {
    loadCreateOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open create modal when navigated from dashboard (optionally with a pre-filled phone)
  useEffect(() => {
    if (autoOpenCreate && !newLeadOpen) {
      setNewLeadOpen(true);
      const digits = sanitizePhoneNumberInput(prefillPhone);
      if (digits) {
        setNewLeadForm((prev) => ({ ...prev, phone: digits }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreate]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target)) {
        setProjectDropdownOpen(false); setProjectSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleProject = (projectId) => {
    setNewLeadForm((prev) => {
      const ids = (prev.project_ids || []).includes(projectId)
        ? prev.project_ids.filter((id) => id !== projectId)
        : [...(prev.project_ids || []), projectId];
      return { ...prev, project_ids: ids };
    });
  };

  const selectedProjectNames = useMemo(
    () => (newLeadForm.project_ids || [])
      .map((id) => getProjectDisplayName(projectOptions.find((p) => p.id === id)))
      .filter(Boolean),
    [newLeadForm.project_ids, projectOptions]
  );


  const filteredProjectOptions = useMemo(() => {
    let opts = projectOptions;
    if (newLeadForm.location_id) {
      opts = opts.filter((p) => String(p.location_id) === String(newLeadForm.location_id));
    }
    if (!projectSearch.trim()) return opts;
    const s = projectSearch.toLowerCase();
    return opts.filter((p) => (p.project_name || '').toLowerCase().includes(s) || (p.project_code || '').toLowerCase().includes(s));
  }, [projectOptions, projectSearch, newLeadForm.location_id]);


  // ── Handlers ──
  const resetNewLeadModal = useCallback(() => {
    setNewLeadForm({
      ...initialNewLead,
      lead_status_id: workspaceRole === 'SM' ? SM_CREATE_STATUS_CODE : '',
      assigned_to: (workspaceRole === 'SM' || workspaceRole === 'SH') ? (user?.id || '') : ''
    });
    setPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
    setAltPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
    setReengageLeadId(null);
    setProjectDropdownOpen(false);
    setProjectSearch('');
    setNewLeadOpen(false);
  }, [workspaceRole, user?.id]);

  useEffect(() => {
    if (!newLeadOpen || workspaceRole !== 'SM') return;
    setNewLeadForm((prev) => {
      if (toCanonicalStatusCode(prev.lead_status_id) === SM_CREATE_STATUS_CODE) return prev;
      return { ...prev, lead_status_id: SM_CREATE_STATUS_CODE };
    });
  }, [newLeadOpen, workspaceRole]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadValidation.isValid) {
      toast.error(newLeadValidation.errors[0] || 'Please complete all required fields');
      return;
    }

    const { primaryPhone, alternatePhone, whatsappPhone } = newLeadValidation.sanitized;

    // For TC: use first selected project from multi-select
    const primaryProjectId = newLeadForm.project_ids?.[0] || newLeadForm.project_id || null;
    const selectedProject = primaryProjectId ? projectOptions.find((p) => p.id === primaryProjectId) : null;
    const selectedSource = sourceOptions.find((s) => s.id === newLeadForm.lead_source_id) || null;
    const selectedLocation = locationOptions.find((l) => l.id === newLeadForm.location_id) || null;

    try {
      setCreating(true);
      const createResponse = await leadWorkflowApi.createLead({
        ...newLeadForm,
        phone: primaryPhone,
        alternate_phone: alternatePhone || undefined,
        whatsapp_number: newLeadForm.whatsappSameAsPhone ? primaryPhone : (whatsappPhone || undefined),
        lead_source_id: newLeadForm.lead_source_id || null,
        lead_sub_source_id: newLeadForm.lead_sub_source_id || null,
        project_id: primaryProjectId,
        project_ids: newLeadForm.project_ids?.length ? newLeadForm.project_ids : undefined,
        location_id: newLeadForm.location_ids?.[0] || newLeadForm.location_id || null,
        location_ids: newLeadForm.location_ids?.length ? newLeadForm.location_ids : undefined,
        source: selectedSource?.source_name || (workspaceRole === 'SM' ? 'Walk In' : null),
        project: selectedProject?.project_name || null,
        location: selectedLocation ? formatLocation(selectedLocation.location_name, selectedLocation.city) : null,
        nextFollowUpAt: newLeadForm.nextFollowUpAt ? new Date(newLeadForm.nextFollowUpAt).toISOString() : undefined,
        lead_status_id: newLeadForm.lead_status_id || undefined,
        callResult: workspaceRole === 'SM' ? undefined : newLeadForm.callResult,
        customerRequirement: workspaceRole === 'SM' ? undefined : (newLeadForm.customerRequirement || undefined),
        customerTypeId: workspaceRole === 'SM' ? undefined : (newLeadForm.customerTypeId || undefined),
        motivationType: workspaceRole === 'SM' ? undefined : (newLeadForm.motivationType || undefined),
        svDate: workspaceRole === 'SM' ? undefined : (newLeadForm.svDate ? new Date(newLeadForm.svDate).toISOString() : undefined),
        timeSpent: workspaceRole === 'SM' ? undefined : (newLeadForm.timeSpent ? Number(newLeadForm.timeSpent) : undefined),
        assignment_mode: ['SM', 'SH', 'TC'].includes(workspaceRole) ? (newLeadForm.assignment_mode || 'ME') : undefined,
        assigned_to: (workspaceRole === 'SM' || workspaceRole === 'SH')
          ? (user?.id || null)
          : (workspaceRole === 'TC'
            ? (selectedNewLeadStatusCode === 'RNR'
              ? (user?.id || null)
              : (newLeadForm.assignment_mode === 'POOL' ? null : (user?.id || null)))
            : (newLeadForm.assigned_to || null)),
        closure_reason_id: newLeadForm.closure_reason_id || undefined,
        note: newLeadForm.remark || undefined,
        remark: newLeadForm.remark || undefined,
        reengage: Boolean(reengageLeadId),
        reengageLeadId: reengageLeadId || undefined,
      });
      toast.success('Lead created successfully');
      resetNewLeadModal();
      if (workspaceRole === 'TC') {
        const createdLead = createResponse?.data || null;
        const targetTab = createdLead?.assignedToUserId ? 'today' : 'new';
        if (activeTab !== targetTab) {
          setActiveTab(targetTab);
        } else {
          loadLeads({ silent: true });
        }
      } else {
        loadLeads({ silent: true });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to create lead'));
    } finally {
      setCreating(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedLead || !noteDraft.trim()) return;
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
    try {
      await leadWorkflowApi.addNote(selectedLead.id, noteDraft.trim());
      setNoteDraft('');
      toast.success('Note added');
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to add note'));
    }
  };

  const handleAction = async (action) => {
    if (!selectedLead) return;
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    // SV Done: open SV Done modal instead of direct action
    if (action.code === 'TC_SV_DONE') {
      setSvDoneForm({
        assignToUserId: '',
        svDate: '',
        svProjectId: '',
        budgetMin: selectedLead.budgetMin ?? '',
        budgetMax: selectedLead.budgetMax ?? '',
        note: actionState.note || '',
      });
      setSvDoneModalOpen(true);
      loadAssignableUsers('SM');
      if (!projectOptions.length) loadCreateOptions();
      return;
    }

    if (action.code === 'SM_SITE_VISIT' || (workspaceRole === 'SM' && action.needsSvDetails)) {
      setRecordSvForm({
        svDate: new Date().toISOString().split('T')[0],
        svProjectId: selectedLead.projectId || '',
        assignToUserId: '',
        budgetMin: selectedLead.budgetMin ?? '',
        budgetMax: selectedLead.budgetMax ?? '',
        motivationType: selectedLead.motivationType || '',
        primaryRequirement: selectedLead.primaryRequirement || '',
        secondaryRequirement: selectedLead.secondaryRequirement || '',
        timeSpent: '',
        note: actionState.note || '',
      });
      setRecordSvModalOpen(true);
      loadAssignableUsers('SH');
      if (!projectOptions.length) loadCreateOptions();
      return;
    }

    // SH Close Won: open Customer Profile modal
    if (action.needsCustomerProfile || action.code === 'SH_BOOKING') {
      setStagePopupOpen(false);
      setCustomerProfileForm({
        buyer_name: `${selectedLead.first_name || ''} ${selectedLead.last_name || ''}`.trim(),
        date_of_birth: '', pan_number: '', aadhar_number: '',
        occupation: '', current_post: '', purchase_type: '', marital_status: '',
        current_address: '', current_area: '', current_city: '', current_state: '', current_pincode: '',
        permanent_address: '', permanent_area: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
        sameAsCurrent: false,
        assignToUserId: '',
        note: actionState.note || '',
        inventoryUnitId: '',
        paymentPlanId: '',
        bookingProjectId: selectedLead.projectId || '',
        bookingLocationId: selectedLead.locationId || '',
        bookingPhaseId: '',
        bookingDate: new Date().toISOString().split('T')[0],
      });
      setCustomerProfileOpen(true);
      loadAssignableUsers('COL');
      // Load phases for the lead's project, then units
      if (selectedLead?.projectId) {
        projectPhaseApi.dropdown(selectedLead.projectId).then(resp => {
          const phases = resp.data?.data || resp.data || [];
          setAvailablePhases(phases);
          if (phases.length === 0) {
            inventoryUnitApi.getDropdown({ project_id: selectedLead.projectId }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([]));
          }
        }).catch(() => {
          setAvailablePhases([]);
          inventoryUnitApi.getDropdown({ project_id: selectedLead.projectId }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([]));
        });
      }
      // Load payment plans
      paymentPlanApi.getDropdown().then(resp => {
        setPaymentPlans(resp.data || []);
      }).catch(() => setPaymentPlans([]));
      return;
    }

    // Cold/Junk/Spam/Drop: open closure reason modal
    if (action.needsReason) {
      const category = getClosureReasonCategoryForAction(action);
      setClosureModalAction(action);
      setClosureForm({ closureReasonId: '', reason: '' });
      // LOST should fetch all active reasons, while other actions fetch by category.
      const categoryParam = category === 'LOST' ? '' : (category || '');
      try {
        const resp = await leadWorkflowApi.getClosureReasons(categoryParam);
        setClosureReasons(resp.data?.rows || resp.data || []);
      } catch { setClosureReasons([]); }
      setClosureModalOpen(true);
      return;
    }

    const payload = {
      note: actionState.note?.trim() || undefined,
      nextFollowUpAt: actionState.nextFollowUpAt ? new Date(actionState.nextFollowUpAt).toISOString() : undefined,
      assignToUserId: actionState.assignToUserId || undefined,
    };

    if (action.needsFollowUp && !payload.nextFollowUpAt) { toast.error('Follow-up date is required'); return; }
    if (action.needsFollowUp && actionState.nextFollowUpAt && !isFollowUpAtLeastMinutesAhead(actionState.nextFollowUpAt)) {
      toast.error('Follow-up date cannot be in the past');
      return;
    }
    const actionCapError = followUpLimitError(actionState.nextFollowUpAt, action?.targetStatusCode || selectedLead?.statusCode);
    if (actionCapError) { toast.error(actionCapError); return; }
    if (action.needsAssignee && !payload.assignToUserId) { toast.error('Please select user to assign'); return; }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, action.code, payload);
      toast.success('Lead updated');
      setActionState({ note: '', nextFollowUpAt: '', assignToUserId: '' });
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update lead'));
    }
  };

  const handleRecordSvSubmit = async () => {
    if (!selectedLead) return;
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
    if (!recordSvForm.assignToUserId) { toast.error('Sales Head selection is mandatory'); return; }
    if (!recordSvForm.svProjectId) { toast.error('Project visited is mandatory'); return; }
    if (recordSvForm.budgetMin === '' || recordSvForm.budgetMax === '') { toast.error('Budget Min and Budget Max are mandatory'); return; }
    if (Number(recordSvForm.budgetMax) < Number(recordSvForm.budgetMin)) { toast.error('Budget Max must be greater than or equal to Budget Min'); return; }
    if (!recordSvForm.motivationType) { toast.error('Buying Motivation is mandatory'); return; }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, 'SM_SITE_VISIT', {
        assignToUserId: recordSvForm.assignToUserId,
        svDate: recordSvForm.svDate,
        svProjectId: recordSvForm.svProjectId,
        budgetMin: Number(recordSvForm.budgetMin),
        budgetMax: Number(recordSvForm.budgetMax),
        motivationType: recordSvForm.motivationType,
        primaryRequirement: recordSvForm.primaryRequirement,
        secondaryRequirement: recordSvForm.secondaryRequirement,
        time_spent: recordSvForm.timeSpent ? Number(recordSvForm.timeSpent) : undefined,
        note: recordSvForm.note?.trim() || undefined,
      });
      toast.success('Site visit recorded and lead moved to selected Sales Head');
      setRecordSvModalOpen(false);
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to record site visit'));
    }
  };

  // ── SV Done submit ──
  const handleSvDoneSubmit = async () => {
    if (!selectedLead) return;
    if (!svDoneForm.assignToUserId) { toast.error('Sales Manager is mandatory'); return; }
    if (!svDoneForm.svDate) { toast.error('Site Visit date is mandatory'); return; }
    if (!svDoneForm.svProjectId) { toast.error('Project visited is mandatory'); return; }
    if ((svDoneForm.budgetMin !== '' || svDoneForm.budgetMax !== '') && (svDoneForm.budgetMin === '' || svDoneForm.budgetMax === '')) { toast.error('Budget Min and Budget Max must both be provided when entering budget details'); return; }
    if (svDoneForm.budgetMin !== '' && svDoneForm.budgetMax !== '' && Number(svDoneForm.budgetMax) < Number(svDoneForm.budgetMin)) { toast.error('Budget Max must be greater than or equal to Budget Min'); return; }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, 'TC_SV_DONE', {
        assignToUserId: svDoneForm.assignToUserId,
        svDate: svDoneForm.svDate ? new Date(svDoneForm.svDate).toISOString() : undefined,
        svProjectId: svDoneForm.svProjectId,
        budgetMin: svDoneForm.budgetMin !== '' ? Number(svDoneForm.budgetMin) : undefined,
        budgetMax: svDoneForm.budgetMax !== '' ? Number(svDoneForm.budgetMax) : undefined,
        note: svDoneForm.note?.trim() || undefined,
      });
      toast.success('SV Done — Lead handed off to Sales Manager');
      setSvDoneModalOpen(false);
      setSelectedLeadId(null);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to mark SV Done'));
    }
  };

  // ── Closure reason submit ──
  const handleClosureSubmit = async () => {
    if (!selectedLead || !closureModalAction) return;
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
    if (!closureForm.closureReasonId && !closureForm.reason.trim()) {
      toast.error('A closure reason is mandatory');
      return;
    }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, closureModalAction.code, {
        closureReasonId: closureForm.closureReasonId || undefined,
        reason: closureForm.reason.trim() || undefined,
        note: closureForm.reason.trim() || undefined,
      });
      toast.success(`Lead marked as ${closureModalAction.label}`);
      setClosureModalOpen(false);
      setClosureModalAction(null);
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update lead'));
    }
  };

  // ── Pincode Autofill ──
  const handlePincodeChange = async (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomerProfileForm(p => ({
      ...p,
      current_pincode: val,
      ...(val.length < 6 ? { current_city: '', current_state: '' } : {}),
    }));

    if (val.length === 6) {
      try {
        const resp = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await resp.json();
        if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
          const po = data[0].PostOffice[0];
          const apiCity = po.District || po.Block || po.Name || '';
          const apiState = po.State || '';
          setCustomerProfileForm(p => ({
            ...p,
            current_city: po.District,
            current_state: po.State
          }));
          if (apiCity || apiState) {
            setCustomerProfileForm(p => ({
              ...p,
              current_pincode: val,
              current_city: apiCity,
              current_state: apiState,
            }));
            return;
          }
        }
      } catch (err) {
        console.error('Failed to fetch pincode details', err);
      }

      const matchedLocation = locationOptions.find((location) => String(location.pincode || '').trim() === val);
      if (matchedLocation) {
        setCustomerProfileForm(p => ({
          ...p,
          current_pincode: val,
          current_city: matchedLocation.city || '',
          current_state: matchedLocation.state || '',
        }));
      }
    }
  };

  // ── Permanent Pincode Autofill ──
  const handlePermanentPincodeChange = async (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomerProfileForm(p => ({
      ...p,
      permanent_pincode: val,
      ...(val.length < 6 ? { permanent_city: '', permanent_state: '' } : {}),
    }));

    if (val.length === 6) {
      try {
        const resp = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await resp.json();
        if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
          const po = data[0].PostOffice[0];
          const apiCity = po.District || po.Block || po.Name || '';
          const apiState = po.State || '';
          if (apiCity || apiState) {
            setCustomerProfileForm(p => ({
              ...p,
              permanent_pincode: val,
              permanent_city: apiCity,
              permanent_state: apiState,
            }));
            return;
          }
        }
      } catch (err) {
        console.error('Failed to fetch pincode details', err);
      }

      const matchedLocation = locationOptions.find((location) => String(location.pincode || '').trim() === val);
      if (matchedLocation) {
        setCustomerProfileForm(p => ({
          ...p,
          permanent_pincode: val,
          permanent_city: matchedLocation.city || '',
          permanent_state: matchedLocation.state || '',
        }));
      }
    }
  };

  // ── Customer Profile Submit (SH Close Won) ──
  const handleCustomerProfileSubmit = async () => {
    if (!selectedLead) return;
    const f = customerProfileForm;
    if (!f.date_of_birth) { toast.error('Date of Birth is required'); return; }
    if (!f.aadhar_number) { toast.error('Aadhar Number is required'); return; }
    if (!f.current_address) { toast.error('Current Address is required'); return; }
    if (!f.occupation) { toast.error('Occupation is required'); return; }
    if (!f.assignToUserId) { toast.error('Please select a Collection Manager'); return; }
    if (!f.paymentPlanId) { toast.error('Please select a Payment Plan'); return; }
    if (!f.bookingDate) { toast.error('Booking Date is required'); return; }

    setManualUpdateSaving(true);
    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, 'SH_BOOKING', {
        assignToUserId: f.assignToUserId,
        bookingDate: f.bookingDate,
        note: f.note?.trim() || 'Booking approved by Sales Head',
        inventoryUnitId: f.inventoryUnitId || undefined,
        payment_plan_id: f.paymentPlanId || undefined,
        bookingLocationId: f.bookingLocationId || undefined,
        bookingProjectId: f.bookingProjectId || undefined,
        location_id: f.bookingLocationId || undefined,
        project_id: f.bookingProjectId || undefined,
        buyer_name: f.buyer_name || undefined,
        relation_type: f.relation_type || undefined,
        relation_name: f.relation_name || undefined,
        customerProfile: {
          buyer_name: f.buyer_name || undefined,
          relation_type: f.relation_type || undefined,
          relation_name: f.relation_name || undefined,
          date_of_birth: f.date_of_birth ? new Date(f.date_of_birth).toISOString() : undefined,
          pan_number: f.pan_number,
          aadhar_number: f.aadhar_number,
          occupation: f.occupation,
          current_post: f.current_post,
          purchase_type: f.purchase_type,
          marital_status: f.marital_status,
          current_address: f.current_address,
          current_area: f.current_area,
          current_city: f.current_city,
          current_state: f.current_state,
          current_pincode: f.current_pincode,
          permanent_address: f.permanent_address,
          permanent_area: f.permanent_area,
          permanent_city: f.permanent_city,
          permanent_state: f.permanent_state,
          permanent_pincode: f.permanent_pincode,
        },
      });
      toast.success('Booking approved! Customer profile saved. Lead transferred to Collection Manager.');
      setCustomerProfileOpen(false);
      setSelectedLeadId(null);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to approve booking'));
    } finally {
      setManualUpdateSaving(false);
    }
  };

  // ── Open the stage transition popup when user selects a stage ──
  const openStagePopup = (actionCode) => {
    const option = stageTransitionOptions.find((o) => o.value === actionCode);
    const action = roleActions.find((a) => a.code === actionCode);
    const nextStatusCode = action?.targetStatusCode || '';
    if (!option) return;
    setStagePopupData({
      actionCode,
      stageLabel: option.stageLabel || option.actionLabel || actionCode,
      followUpAt: '',
      reason: '',
      assignToUserId: '',
      needsFollowUp: Boolean(option.needsFollowUp),
      callResult: nextStatusCode === 'RNR' ? 'Not Answered' : 'Answered',
    });

    if (action?.needsAssignee) {
      const role = getAssigneeRoleForAction(action, workspaceRole);
      loadAssignableUsers(role);
    }
    // Initialize missing-location/project picks from the selected lead so validation works
    setQuickMissingLocationId(
      selectedLead?.interestedLocations?.[0]
        ? String(selectedLead.interestedLocations[0])
        : (selectedLead?.locationId ? String(selectedLead.locationId) : '')
    );
    setQuickMissingProjectIds(
      selectedLead?.interestedProjects?.length
        ? selectedLead.interestedProjects.map((id) => String(id))
        : (selectedLead?.projectId ? [String(selectedLead.projectId)] : [])
    );
    setQuickLocationSearch('');
    setQuickProjectSearch('');
    setStagePopupOpen(true);
  };

  // ── Confirm stage transition from popup ──
  const handleStagePopupConfirm = async () => {
    if (!selectedLead || !stagePopupData.actionCode) return;
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    const popupAction = roleActions.find((a) => a.code === stagePopupData.actionCode);
    if (popupAction?.needsCustomerProfile || popupAction?.code === 'SH_BOOKING') {
      setStagePopupOpen(false);
      setCustomerProfileForm({
        buyer_name: `${selectedLead.first_name || ''} ${selectedLead.last_name || ''}`.trim(),
        date_of_birth: '', pan_number: '', aadhar_number: '',
        occupation: '', current_post: '', purchase_type: '', marital_status: '',
        current_address: '', current_area: '', current_city: '', current_state: '', current_pincode: '',
        permanent_address: '', permanent_area: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
        sameAsCurrent: false,
        assignToUserId: '',
        note: stagePopupData.reason || actionState.note || '',
        inventoryUnitId: '',
        paymentPlanId: '',
        bookingProjectId: selectedLead.projectId || '',
        bookingLocationId: selectedLead.locationId || '',
        bookingPhaseId: '',
        bookingDate: new Date().toISOString().split('T')[0],
      });
      setCustomerProfileOpen(true);
      loadAssignableUsers('COL');
      // Load phases then units
      if (selectedLead?.projectId) {
        projectPhaseApi.dropdown(selectedLead.projectId).then(resp => {
          const phases = resp.data?.data || resp.data || [];
          setAvailablePhases(phases);
          if (phases.length === 0) {
            inventoryUnitApi.getDropdown({ project_id: selectedLead.projectId }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([]));
          }
        }).catch(() => {
          setAvailablePhases([]);
          inventoryUnitApi.getDropdown({ project_id: selectedLead.projectId }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([]));
        });
      }
      // Load payment plans
      paymentPlanApi.getDropdown().then(resp => {
        setPaymentPlans(resp.data || []);
      }).catch(() => setPaymentPlans([]));
      return;
    }

    if (stagePopupData.needsFollowUp && !stagePopupData.followUpAt) {
      toast.error('Follow-up date is required for this stage');
      return;
    }

    if (stagePopupData.followUpAt && !isFollowUpAtLeastMinutesAhead(stagePopupData.followUpAt)) {
      toast.error('Follow-up date cannot be in the past');
      return;
    }
    const stageCapError = followUpLimitError(stagePopupData.followUpAt, stagePopupAction?.targetStatusCode || selectedLead?.statusCode);
    if (stageCapError) { toast.error(stageCapError); return; }

    if (!selectedLeadHasLocation || !selectedLeadHasProject) {
      if (!selectedLeadHasLocation && !quickMissingLocationId) {
        toast.error('Please select a location for this lead');
        return;
      }
      if (!selectedLeadHasProject && quickMissingProjectIds.length === 0) {
        toast.error('Please select a project for this lead');
        return;
      }
    }

    if (stagePopupAction?.needsAssignee && !stagePopupData.assignToUserId) {
      toast.error(stagePopupAction.code === 'TC_SV_DONE' ? 'Please select a Sales Manager' : 'Please select an assignee');
      return;
    }

    setManualUpdateSaving(true);
    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, stagePopupData.actionCode, {
        note: stagePopupData.reason.trim(),
        nextFollowUpAt: stagePopupData.followUpAt ? new Date(stagePopupData.followUpAt).toISOString() : undefined,
        callResult: shouldShowCallStatus(stagePopupAction?.targetStatusCode) ? stagePopupData.callResult : undefined,
        assignToUserId: stagePopupData.assignToUserId || undefined,
        location_id: quickMissingLocationId || undefined,
        location_ids: quickMissingLocationId ? [quickMissingLocationId] : undefined,
        project_id: quickMissingProjectIds[0] || undefined,
        project_ids: quickMissingProjectIds.length > 0 ? quickMissingProjectIds : undefined,
      });
      toast.success('Stage updated successfully');
      setStagePopupOpen(false);
      setStagePopupData({ actionCode: '', stageLabel: '', followUpAt: '', reason: '', needsFollowUp: false });
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update stage'));
    } finally {
      setManualUpdateSaving(false);
    }
  };

  const handleManualStatusUpdate = async () => {
    if (!selectedLead) return;
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    const statusChanged = manualStatus && manualStatus !== selectedLead.statusCode;
    const followUpChanged = Boolean(manualNextFollowUpAt)
      && toDayStart(manualNextFollowUpAt)?.getTime() !== toDayStart(selectedLead.nextFollowUpAt)?.getTime();

    if (!statusChanged && !followUpChanged && !noteDraft.trim()) {
      toast('No changes to update');
      return;
    }

    const commonPayload = {
      note: noteDraft.trim() || undefined,
      nextFollowUpAt: manualNextFollowUpAt ? new Date(manualNextFollowUpAt).toISOString() : undefined,
      location_id: quickMissingLocationId || undefined,
      location_ids: quickMissingLocationId ? [quickMissingLocationId] : undefined,
      project_id: quickMissingProjectIds[0] || undefined,
      project_ids: quickMissingProjectIds.length > 0 ? quickMissingProjectIds : undefined,
    };

    if (manualNextFollowUpAt && !isFollowUpAtLeastMinutesAhead(manualNextFollowUpAt)) {
      toast.error('Follow-up date cannot be in the past');
      return;
    }
    const manualCapError = followUpLimitError(manualNextFollowUpAt, toCanonicalStatusCode(manualStatus) || selectedLead?.statusCode);
    if (manualCapError) { toast.error(manualCapError); return; }

    setManualUpdateSaving(true);
    try {
      if (statusChanged || followUpChanged) {
        await leadWorkflowApi.updateLeadStatus(selectedLead.id, manualStatus || selectedLead.statusCode, commonPayload);
      }
      toast.success('Lead updated successfully');
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update lead'));
    } finally {
      setManualUpdateSaving(false);
    }
  };

  const handleAssignLead = async () => {
    if (!selectedLead || !assignTarget.userId) return;
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
    try {
      await leadWorkflowApi.assignLead(selectedLead.id, assignTarget.userId, assignTarget.note?.trim() || '');
      toast.success('Lead assigned successfully');
      setAssignTarget({ userId: '', note: '' });
      setAssignModalOpen(false);
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to assign lead'));
    }
  };

  const resetQuickWorkflowForm = useCallback(() => {
    setQuickWorkflowAction(null);
    setQuickVoice(null);
    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);
    setQuickMissingLocationId('');
    setQuickMissingProjectIds([]);
    setQuickLocationSearch('');
    setQuickProjectSearch('');
    setQuickLocationDropdownOpen(false);
    setQuickProjectDropdownOpen(false);
    setQuickWorkflowForm({
      note: '',
      statusRemarkText: '',
      nextFollowUpAt: '',
      assignToUserId: '',
      closureReasonId: '',
      reason: '',
      svDate: '',
      svProjectId: '',
      budgetMin: '',
      budgetMax: '',
      motivationType: '',
      primaryRequirement: '',
      secondaryRequirement: '',
      timeSpent: '',
      scheduled_time_slot: '',
      customerTypeId: '',
      customerRequirement: '',
      ...EMPTY_VISIT_DETAILS,
    });
  }, []);

  const runQuickWorkflowAction = useCallback(async (action, payload = {}) => {
    if (!quickActionLead || !action) return;
    if (isLeadReadOnly(quickActionLead)) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    setQuickActionLoading(true);
    try {
      await leadWorkflowApi.transitionLead(quickActionLead.id, action.code, payload);
      toast.success(`${action.label} updated successfully`);
      resetQuickWorkflowForm();
      setQuickActionLead(null);
      setSelectedLeadId(null);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${action.label.toLowerCase()}`));
    } finally {
      setQuickActionLoading(false);
    }
  }, [quickActionLead, loadLeads, resetQuickWorkflowForm, isLeadReadOnly]);

  const handleQuickWorkflowActionSelect = async (action, prefill = null) => {
    if (!action) return;
    if (isLeadReadOnly(quickActionLead)) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    const targetAssigneeRole = getAssigneeRoleForAction(action, workspaceRole);

    const needsInput = Boolean(
      action.needsFollowUp
      || action.needsAssignee
      || action.needsReason
      || action.needsSvDetails
      || action.needsCustomerProfile
      || action.code === 'TC_SV_DONE'
    );

    if (!needsInput) {
      await runQuickWorkflowAction(action, {});
      return;
    }

    // Apply selection and initialize form first so button/UI responds instantly.
    setQuickWorkflowAction(action);
    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);
    setQuickMissingLocationId(
      quickActionLead?.interestedLocations?.[0]
        ? String(quickActionLead.interestedLocations[0])
        : (quickActionLead?.locationId ? String(quickActionLead.locationId) : '')
    );
    setQuickMissingProjectIds(
      quickActionLead?.interestedProjects?.length
        ? quickActionLead.interestedProjects.map((id) => String(id))
        : (quickActionLead?.projectId ? [String(quickActionLead.projectId)] : [])
    );
    setQuickWorkflowForm({
      note: '',
      statusRemarkText: '',
      nextFollowUpAt: '',
      assignToUserId: '',
      closureReasonId: '',
      reason: '',
      svDate: new Date().toISOString().split('T')[0],
      svProjectId: quickActionLead?.projectId || '',
      budgetMin: quickActionLead?.budgetMin ?? '',
      budgetMax: quickActionLead?.budgetMax ?? '',
      motivationType: quickActionLead?.motivationType || '',
      primaryRequirement: quickActionLead?.primaryRequirement || '',
      secondaryRequirement: quickActionLead?.secondaryRequirement || '',
      timeSpent: '',
      scheduled_time_slot: '',
      customerTypeId: quickActionLead?.customerTypeId || '',
      customerRequirement: quickActionLead?.primaryRequirement || '',
      ...EMPTY_VISIT_DETAILS,
      callResult: action.targetStatusCode === 'RNR' ? 'Not Answered' : 'Answered',
      locationId: quickActionLead?.interestedLocations?.[0]
        ? String(quickActionLead.interestedLocations[0])
        : (quickActionLead?.locationId ? String(quickActionLead.locationId) : ''),
      projectIds: quickActionLead?.interestedProjects?.length
        ? quickActionLead.interestedProjects.map((id) => String(id))
        : (quickActionLead?.projectId ? [String(quickActionLead.projectId)] : []),
      // Prefill from the same-day previous update so it can be edited (rewritten).
      ...(prefill?.statusRemarkText ? { statusRemarkText: prefill.statusRemarkText, note: prefill.statusRemarkText } : {}),
      ...(prefill?.nextFollowUpAt ? { nextFollowUpAt: prefill.nextFollowUpAt } : {}),
      ...(prefill?.callResult ? { callResult: prefill.callResult } : {}),
    });

    if (action.needsAssignee) {
      loadAssignableUsers(targetAssigneeRole);
    }
    if (action.needsCustomerProfile || action.code === 'SH_BOOKING') {
      // Start every new booking from a clean slate — only the current lead's
      // own details carry over, never the previous booking's buyer data.
      setCustomerProfileForm({
        buyer_name: `${quickActionLead?.first_name || ''} ${quickActionLead?.last_name || ''}`.trim(),
        date_of_birth: '', pan_number: '', aadhar_number: '',
        occupation: '', current_post: '', purchase_type: '', marital_status: '',
        current_address: '', current_area: '', current_city: '', current_state: '', current_pincode: '',
        permanent_address: '', permanent_area: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
        sameAsCurrent: false,
        assignToUserId: '',
        note: '',
        inventoryUnitId: '',
        paymentPlanId: '',
        bookingProjectId: quickActionLead?.projectId || '',
        bookingLocationId: quickActionLead?.locationId || '',
        bookingPhaseId: '',
        bookingDate: new Date().toISOString().split('T')[0],
      });
      setAvailableUnits([]);
      setAvailablePhases([]);
      loadAssignableUsers('COL');
      // Load phases for the project, then units
      const projectIdForUnits = quickActionLead?.projectId;
      if (projectIdForUnits) {
        projectPhaseApi.dropdown(projectIdForUnits).then(resp => {
          const phases = resp.data?.data || resp.data || [];
          setAvailablePhases(phases);
          if (phases.length === 0) {
            inventoryUnitApi.getDropdown({ project_id: projectIdForUnits }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([]));
          }
        }).catch(() => {
          setAvailablePhases([]);
          inventoryUnitApi.getDropdown({ project_id: projectIdForUnits }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([]));
        });
      } else {
        setAvailablePhases([]);
        setAvailableUnits([]);
      }
      // Load payment plans
      paymentPlanApi.getDropdown().then(resp => {
        setPaymentPlans(resp.data || []);
      }).catch(() => setPaymentPlans([]));
    }

    if (action.needsSvDetails && action.code !== 'TC_SV_DONE') {
      loadAssignableUsers(targetAssigneeRole);
      if (!projectOptions.length) loadCreateOptions();
    }

    if (action.needsReason) {
      try {
        // Fetch specific category if not 'LOST', otherwise fetch all active reasons
        const reasonCategory = getClosureReasonCategoryForAction(action);
        const category = reasonCategory === 'LOST' ? '' : (reasonCategory || '');
        const resp = await leadWorkflowApi.getClosureReasons(category);
        setClosureReasons(resp.data?.rows || resp.data || []);
      } catch {
        setClosureReasons([]);
      }
    }

    // Fetch dynamic remarks for the selected action's target status
    if (action.targetStatusCode) {
      try {
        const resp = await statusRemarkApi.getByStatusCode(action.targetStatusCode);
        const remarks = resp.data?.remarks || [];
        setQuickStatusRemarks(remarks);

        // Initialize Ans/Non-Ans based on first remark or action
        if (remarks.length > 0) {
          const firstRemark = remarks[0];
          if (firstRemark.has_ans_non_ans) {
            // Default to the remark's default or 'Answered' if not specified
            setQuickRemarkAnsNonAns(firstRemark.ans_non_ans_default || 'Answered');
          } else {
            setQuickRemarkAnsNonAns(null);
          }
        } else {
          setQuickRemarkAnsNonAns(null);
        }
      } catch (err) {
        console.error('Failed to fetch remarks:', err);
        setQuickStatusRemarks([]);
        setQuickRemarkAnsNonAns(null);
      }
    }

    // Pre-load TCs for reassignment dropdown
    loadAssignableUsers('TC');
  };


  const handleQuickWorkflowSubmit = async () => {
    if (!quickActionLead) return;
    if (isLeadReadOnly(quickActionLead)) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
    if (!quickWorkflowAction) {
      toast.error('Please select an action button first');
      return;
    }
    setQuickActionLoading(true);

    try {
      const f = quickWorkflowForm;


      // 2. Handle Workflow Transition if action selected
      if (quickWorkflowAction) {
        // Validation: Follow-up date is required for certain actions
        if (quickWorkflowAction.needsFollowUp && !f.nextFollowUpAt) {
          toast.error('Please select a follow-up date');
          setQuickActionLoading(false);
          return;
        }

        if (f.nextFollowUpAt && !isFollowUpAtLeastMinutesAhead(f.nextFollowUpAt)) {
          toast.error('Follow-up date cannot be in the past');
          setQuickActionLoading(false);
          return;
        }
        const quickCapError = followUpLimitError(f.nextFollowUpAt, quickWorkflowAction?.targetStatusCode || selectedLead?.statusCode);
        if (quickCapError) { toast.error(quickCapError); setQuickActionLoading(false); return; }

        if (isRemarkMandatoryForAction(quickWorkflowAction)) {
          const hasRemark = Boolean((f.statusRemarkText || '').trim() || (f.note || '').trim());
          if (!hasRemark) {
            toast.error('Remark is mandatory for this status/action');
            setQuickActionLoading(false);
            return;
          }
        }

        if (quickWorkflowNeedsMissingLocationProject) {
          const hasLocationForSubmit = quickLeadHasLocation
            || (f.locationId && String(f.locationId).trim() !== '')
            || (quickMissingLocationId && String(quickMissingLocationId).trim() !== '');
          const hasProjectForSubmit = quickLeadHasProject
            || (f.projectIds && f.projectIds.length > 0)
            || (quickMissingProjectIds && quickMissingProjectIds.length > 0);

          if (!hasLocationForSubmit) {
            toast.error('Please select a location for this lead before performing this action.');
            setQuickActionLoading(false);
            return;
          }

          if (!hasProjectForSubmit) {
            toast.error('Please select a project for this lead before performing this action.');
            setQuickActionLoading(false);
            return;
          }
        }

        if (quickWorkflowAction.needsAssignee && !f.assignToUserId) {
          toast.error(quickWorkflowAction.code === 'TC_SV_DONE' ? 'Please select a Sales Manager' : 'Please select an assignee');
          setQuickActionLoading(false);
          return;
        }

        if ((quickWorkflowAction.needsSvDetails || quickWorkflowAction.code === 'TC_SV_DONE') && !f.svDate) {
          toast.error('Please select the site visit date');
          setQuickActionLoading(false);
          return;
        }

        if ((quickWorkflowAction.needsSvDetails || quickWorkflowAction.code === 'TC_SV_DONE') && !f.svProjectId) {
          toast.error('Please select the project visited');
          setQuickActionLoading(false);
          return;
        }

        // Full site-visit capture parity for SM "Record Site Visit"
        if (quickWorkflowAction.code === 'SM_SITE_VISIT') {
          if (!f.assignToUserId) {
            toast.error('Please select a Sales Head');
            setQuickActionLoading(false);
            return;
          }
          if (!f.customerTypeId) {
            toast.error('Please select a Customer Type');
            setQuickActionLoading(false);
            return;
          }
          if (!f.motivationType) {
            toast.error('Please select a Motivation');
            setQuickActionLoading(false);
            return;
          }
          if (!f.customerRequirement?.trim()) {
            toast.error('Please enter the Customer Requirement');
            setQuickActionLoading(false);
            return;
          }
          if (!f.timeSpent) {
            toast.error('Please enter Time Spent (mins)');
            setQuickActionLoading(false);
            return;
          }
          if (!isVisitDetailsComplete(f)) {
            toast.error('Please fill all the site visit detail fields');
            setQuickActionLoading(false);
            return;
          }
        }

        // Validation: Customer Profile for specific actions
        if (quickWorkflowAction.needsCustomerProfile || quickWorkflowAction.code === 'SH_BOOKING') {
          const cpF = customerProfileForm;
          if (!cpF.date_of_birth || !cpF.aadhar_number || !cpF.current_address || !cpF.occupation) {
            toast.error('Please fill all mandatory (*) customer profile fields (DOB, Aadhar, Address, Occupation).');
            setQuickActionLoading(false);
            return;
          }
        }

        // Validation: Booking Location, Project and Unit are mandatory for SH_BOOKING
        if (quickWorkflowAction.code === 'SH_BOOKING') {
          const cpF = customerProfileForm;
          if (!cpF.bookingLocationId) {
            toast.error('Please select Location *');
            setQuickActionLoading(false);
            return;
          }
          if (!cpF.bookingProjectId) {
            toast.error('Please select Project *');
            setQuickActionLoading(false);
            return;
          }
          if (!cpF.inventoryUnitId) {
            toast.error('Please select Unit/Plot *');
            setQuickActionLoading(false);
            return;
          }
          if (!cpF.bookingDate) {
            toast.error('Please select Booking Date *');
            setQuickActionLoading(false);
            return;
          }
        }

        // Validation: Reason selection is mandatory for reason-based actions
        if (quickWorkflowAction.needsReason && !f.closureReasonId) {
          toast.error('Please select Reason *');
          setQuickActionLoading(false);
          return;
        }

        const payload = {
          note: f.note.trim() || undefined,
          statusRemarkText: f.statusRemarkText?.trim() || undefined,
          statusRemarkResponseType: quickWorkflowAction.code === 'SH_BOOKING'
            ? undefined
            : (quickRemarkAnsNonAns || f.callResult || undefined),
          nextFollowUpAt: f.nextFollowUpAt ? new Date(f.nextFollowUpAt).toISOString() : undefined,
          assignToUserId: f.assignToUserId || undefined,
          closureReasonId: f.closureReasonId || undefined,
          callResult: undefined,
          reason: f.reason.trim() || undefined,
          svDate: f.svDate || undefined,
          svProjectId: f.svProjectId || undefined,
          budgetMin: (quickWorkflowAction.needsSvDetails && quickWorkflowAction.code !== 'TC_SV_DONE' && f.budgetMin !== '') ? Number(f.budgetMin) : undefined,
          budgetMax: (quickWorkflowAction.needsSvDetails && quickWorkflowAction.code !== 'TC_SV_DONE' && f.budgetMax !== '') ? Number(f.budgetMax) : undefined,
          motivationType: f.motivationType || undefined,
          primaryRequirement: f.primaryRequirement || undefined,
          secondaryRequirement: f.secondaryRequirement || undefined,
          // server expects `time_spent`; keep camel-case for compatibility elsewhere
          time_spent: f.timeSpent ? Number(f.timeSpent) : undefined,
        };

        // SM "Record Site Visit" — full capture matching the Add Site Visit modal.
        // The Sales Head is recorded as negotiator (read-only visibility) rather than
        // reassigning the lead, so send salesHeadUserId and clear assignToUserId.
        if (quickWorkflowAction.code === 'SM_SITE_VISIT') {
          payload.salesHeadUserId = f.assignToUserId || undefined;
          payload.assignToUserId = undefined;
          payload.customerTypeId = f.customerTypeId || undefined;
          payload.customerRequirement = f.customerRequirement?.trim() || undefined;
          payload.primaryRequirement = f.customerRequirement?.trim() || undefined;
          payload.scheduled_time_slot = f.scheduled_time_slot?.trim() || undefined;
          payload.remarks = f.note?.trim() || undefined;
          Object.assign(payload, pickVisitDetails(f));
        }

        // ── ALWAYS include location/project IDs from form state, quickMissing state, OR existing lead data ──
        const intLocs = (quickActionLead?.interestedLocations || []).filter(id => id && String(id).trim() !== '');
        const formLocId = (f.locationId && String(f.locationId).trim() !== '') ? f.locationId : '';
        const missingLocId = (quickMissingLocationId && String(quickMissingLocationId).trim() !== '') ? quickMissingLocationId : '';
        const resolvedLocationId = formLocId
          || missingLocId
          || quickActionLead?.locationId
          || (intLocs.length > 0 ? intLocs[0] : '');

        const intProjs = (quickActionLead?.interestedProjects || []).filter(id => id && String(id).trim() !== '');
        const formProjIds = (f.projectIds && f.projectIds.length > 0)
          ? f.projectIds.filter(id => id && String(id).trim() !== '')
          : [];
        const missingProjIds = (quickMissingProjectIds && quickMissingProjectIds.length > 0)
          ? quickMissingProjectIds.filter(id => id && String(id).trim() !== '')
          : [];
        const resolvedProjectIds = formProjIds.length > 0
          ? formProjIds
          : (missingProjIds.length > 0
            ? missingProjIds
            : (intProjs.length > 0
              ? intProjs.map(String)
              : (quickActionLead?.projectId ? [String(quickActionLead.projectId)] : [])));

        // eslint-disable-next-line no-console
        console.warn('[TRANSITION PAYLOAD DEBUG]', {
          formLocationId: f.locationId,
          formProjectIds: f.projectIds,
          quickMissingLocationId,
          quickMissingProjectIds,
          leadLocationId: quickActionLead?.locationId,
          leadInterestedLocations: quickActionLead?.interestedLocations,
          resolvedLocationId,
          resolvedProjectIds,
        });

        if (resolvedLocationId) {
          payload.location_id = resolvedLocationId;
          payload.locationId = resolvedLocationId;
          payload.location_ids = [resolvedLocationId];
        }

        if (resolvedProjectIds.length > 0) {
          payload.project_id = resolvedProjectIds[0];
          payload.projectId = resolvedProjectIds[0];
          payload.project_ids = resolvedProjectIds;
        }

        // Enrich payload with customer profile if needed
        if (quickWorkflowAction.needsCustomerProfile || quickWorkflowAction.code === 'SH_BOOKING') {
          const pF = customerProfileForm;
          payload.customerProfile = {
            buyer_name: pF.buyer_name || undefined,
            date_of_birth: pF.date_of_birth ? new Date(pF.date_of_birth).toISOString() : undefined,
            pan_number: pF.pan_number,
            aadhar_number: pF.aadhar_number,
            occupation: pF.occupation,
            current_post: pF.current_post,
            purchase_type: pF.purchase_type,
            marital_status: pF.marital_status,
            current_address: pF.current_address,
            current_area: pF.current_area,
            current_city: pF.current_city,
            current_state: pF.current_state,
            current_pincode: pF.current_pincode,
            assignToUserId: pF.assignToUserId,
            note: pF.note,
          };
          payload.buyer_name = pF.buyer_name || undefined;
          payload.bookingDate = pF.bookingDate || undefined;
          payload.inventoryUnitId = pF.inventoryUnitId || undefined;
          payload.payment_plan_id = pF.paymentPlanId || undefined;
          payload.bookingLocationId = pF.bookingLocationId || undefined;
          payload.bookingProjectId = pF.bookingProjectId || undefined;
          payload.phase_id = pF.bookingPhaseId || undefined;
          payload.location_id = pF.bookingLocationId || undefined;
          payload.project_id = pF.bookingProjectId || undefined;
        }

        if (quickWorkflowAction.code === 'TC_REASSIGN') {
          if (!f.assignToUserId) {
            toast.error('Please select a telecaller to reassign');
            setQuickActionLoading(false);
            return;
          }
          await leadWorkflowApi.assignLead(quickActionLead.id, f.assignToUserId, f.note.trim() || 'Telecaller manual reassignment');
        } else {
          // Log payload to help debug 400 errors from server
          // eslint-disable-next-line no-console
          console.debug('Submitting transition payload', { leadId: quickActionLead.id, action: quickWorkflowAction.code, payload });
          try {
            await leadWorkflowApi.transitionLead(quickActionLead.id, quickWorkflowAction.code, payload);
          } catch (apiErr) {
            // If server returned structured error, show it
            if (apiErr?.response?.data) {
              const msg = apiErr.response.data.message || apiErr.response.data.error || JSON.stringify(apiErr.response.data);
              toast.error(msg);
            }
            throw apiErr;
          }
        }
      }

      // Persist the recorded voice note (if any) as a timeline activity on the lead.
      if (quickVoice?.blob && quickActionLead?.id) {
        try {
          await leadWorkflowApi.addVoiceNote(quickActionLead.id, quickVoice.blob, {
            duration: quickVoice.duration,
            content: (quickWorkflowForm.statusRemarkText || quickWorkflowForm.note || '').trim() || undefined,
          });
        } catch {
          toast.error('The action saved, but the voice note could not be uploaded.');
        }
      }

      toast.success('Lead updated successfully');
      resetQuickWorkflowForm();
      setQuickActionLead(null);
      setSelectedLeadId(null);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update lead'));
    } finally {
      setQuickActionLoading(false);
    }
  };



  // Loading state
  if (configLoading) {
    return (
      <section className="lead-workspace">
        <div className="lead-workspace__loading">
          <div className="loading-spinner" />
          <p>Loading workspace configuration...</p>
        </div>
      </section>
    );
  }

  // ── Render a single lead row (used for both grouped and ungrouped views) ──
  const renderLeadRow = (lead, groupKey = null) => {
    const isExpanded = expandedLeadIds.has(lead.id);
    const leadTableRemarks = getUserRemarkText({ description: lead.remarks, metadata: lead.metadata })
      || String(lead.remarks || '').trim();
    const latestNote = leadTableRemarks
      ? Array.from(new Set(
        leadTableRemarks
          .split('|')
          .map((part) => part.trim())
          .filter(Boolean)
      )).join(' | ')
      : '-';

    // Badge-system triple (bg/text/border) derived from the DB status color.
    const statusChipColor = lead.statusColor;

    return (
      <React.Fragment key={lead.id}>
        <tr className={`${selectedLeadId === lead.id ? 'is-selected' : ''}${groupKey ? ' lead-row--grouped' : ''}`}>
          <td className="show-mobile lead-col-toggle" style={{ padding: '10px 0', textAlign: 'center' }}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpandLead(lead.id); }}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
            >
              {isExpanded ? <ChevronDownIcon style={{ width: 14, height: 14 }} /> : <ChevronRightIcon style={{ width: 14, height: 14 }} />}
            </button>
          </td>
          <td className="lead-col-lead">
            <p className="lead-title">
              {lead.fullName}
              {lead.newHotSince && (
                <span
                  title={`New/Hot since ${formatDateTime(lead.newHotSince)} — fresh API lead or re-enquiry, pending first update`}
                  style={{
                    marginLeft: 6, padding: '1px 6px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
                    background: '#FFF7ED', border: '1px solid #FDBA74', color: '#C2410C', verticalAlign: 'middle',
                  }}
                >
                  New/Hot
                </span>
              )}
            </p>
            <small>
              <a
                href={`/portal/lead/${lead.id}`}
                onClick={(e) => { e.preventDefault(); navigate(`/portal/lead/${lead.id}`, { state: { viaSearch: Boolean(filters.search.trim()) } }); }}
                style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
              >
                {lead.leadNumber}
              </a>
            </small>
          </td>
          {workspaceRole !== 'SH' && (
            <td className="hide-mobile">
              <p className="lead-title">{lead.phone}</p>
            </td>
          )}
          <td className="lead-col-status">
            <span
              className={`status-chip ${lead.isClosed ? 'status-chip--closed' : ''}`}
              style={badgeStyle(statusChipColor)}
            >
              {lead.statusLabel}
            </span>
            <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, fontWeight: 400, color: '#000000' }}>
              {lead.nextFollowUpAt ? (
                <>
                  <span>{new Date(lead.nextFollowUpAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <ArrowDownLeftIcon style={{ width: 12, height: 12, color: lead.nextFollowUpAt && isFollowUpMissedByDate(lead.nextFollowUpAt) && !lead.isClosed ? '#e80d0dff' : '#000000' }} />
                </>
              ) : <span>—</span>}
            </div>
          </td>
          {workspaceRole !== 'SH' && (
            <td className="hide-mobile">
              <p className="lead-title">{lead.source || '-'}</p>
              <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>{lead.subSource || '-'}</small>
            </td>
          )}
          <td className="hide-mobile">
            <p className="lead-title">{(() => {
              const projText = lead.interestedProjects?.length > 0
                ? lead.interestedProjects.map((pid) => projectOptions.find((p) => p.id === pid)?.project_name).filter(Boolean).join(', ')
                : lead.project;
              return projText || '-';
            })()}</p>
            {(() => {
              const locText = lead.interestedLocations?.length > 0
                ? lead.interestedLocations.map((lid) => locationOptions.find((l) => l.id === lid)?.location_name).filter(Boolean).join(', ')
                : cleanRepeatingLocation(lead.location);
              return locText ? (
                <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Location: {locText}</small>
              ) : null;
            })()}
          </td>
          <td className="hide-mobile">
            <p className="assigned-name">{lead.assignedToUserName || 'Unassigned'}</p>
            <small className="assigned-role">
              {lead.assignedRoleLabel || lead.ownerRoleLabel || lead.assignedRole || lead.ownerRole || 'Pool'}
            </small>
          </td>
          <td className="hide-mobile">
            <small style={{ color: 'var(--text-secondary)' }}>{latestNote}</small>
          </td>
          <td className="lead-col-followup" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            <div className="lead-workspace__actions-cell">
              {/* View lead — always available, like the Lead Management table. */}
              <button
                type="button"
                className="view-link lead-action-view-btn"
                title="View lead"
                style={{ marginRight: 6 }}
                onClick={(e) => { e.stopPropagation(); navigate(`/portal/lead/${lead.id}`, { state: { viaSearch: Boolean(filters.search.trim()) } }); }}
              >
                View
              </button>
              {!lead.assignedToUserId && activeTab === 'new' && (
                <button
                  className="crm-btn crm-btn-sm"
                  style={{ marginRight: 4, background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await leadWorkflowApi.assignLead(lead.id, user.id, 'Self-assigned from pool');
                      toast.success(`Lead claimed: ${lead.fullName}`);
                      setSelectedLeadId(null);
                      setActiveTab('today');
                    } catch (err) {
                      toast.error(getErrorMessage(err, 'Failed to claim lead'));
                    }
                  }}
                >
                  <><HandRaisedIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Claim</>
                </button>
              )}
              {(lead.assignedToUserId || activeTab !== 'new') && (
                <button
                  className="crm-btn crm-btn-primary crm-btn-sm"
                  disabled={
                    isLeadReadOnly(lead)
                    // A searched-up lead is deliberately looked up (e.g. a customer
                    // calling in) — the missed-first gate must not block acting on it.
                    || (FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && activeTab === 'today' && hasPendingMissedFollowupsForMe && !filters.search.trim())
                  }
                  title={
                    FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && activeTab === 'today' && hasPendingMissedFollowupsForMe && !filters.search.trim()
                      ? 'Complete missed follow-ups first to enable today actions'
                      : undefined
                  }
                  onClick={async (e) => {
                    e.stopPropagation();
                    resetQuickWorkflowForm();
                    setQuickActionLead(lead);
                    setQaActiveTab('history');
                    // Load site visits and activities for this lead
                    let activities = [];
                    try {
                      const [svResp, actResp] = await Promise.all([
                        siteVisitApi.getAll({ lead_id: lead.id }),
                        leadWorkflowApi.getLeadActivities(lead.id)
                      ]);
                      setQuickActionSiteVisits(svResp.data?.rows || svResp.data || []);
                      activities = actResp.data || [];
                      setQuickActionActivities(activities);
                    } catch {
                      setQuickActionSiteVisits([]);
                      setQuickActionActivities([]);
                    }

                    // Auto-select last action based on the lead's current status
                    if (!lead.isClosed) {
                      const leadStatus = lead.statusCode || '';
                      if (leadStatus) {
                        const matchingAction = roleActions.find(
                          (a) => a.targetStatusCode === leadStatus && a.tone !== 'danger'
                        );
                        if (matchingAction) {
                          // If this lead was already updated today, prefill the form with
                          // that update so a same-day edit rewrites it instead of adding a row.
                          const todayUpdate = activities.find((a) => {
                            const d = new Date(a.at || a.created_at);
                            return !Number.isNaN(d.getTime())
                              && isSameLocalDay(d, new Date())
                              && getUserRemarkText(a);
                          });
                          const prefill = todayUpdate ? {
                            statusRemarkText: getUserRemarkText(todayUpdate),
                            // Activity metadata doesn't carry the follow-up date; fall back to the
                            // lead's current next_follow_up_date (set by the same-day update).
                            nextFollowUpAt: followUpIsoToInputValue(getScheduledFollowUpIso(todayUpdate) || lead.nextFollowUpAt),
                            callResult: todayUpdate.metadata?.statusRemarkResponseType
                              || todayUpdate.metadata?.callResult
                              || todayUpdate.metadata?.last_call_result
                              || '',
                          } : null;
                          setTimeout(() => handleQuickWorkflowActionSelect(matchingAction, prefill), 100);
                        }
                      }
                    }
                  }}
                >
                  <BoltIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Follow up
                </button>
              )}
            </div>
          </td>
        </tr>
        {isExpanded && (
          <tr className="lead-workspace__expanded-row show-mobile">
            <td colSpan={4}>
              <div className="lead-workspace__expanded-card">
                <div className="expanded-info-grid">
                  {workspaceRole !== 'SH' && (
                    <div className="expanded-info-item">
                      <label>Contact</label>
                      <p>{lead.phone} {lead.email ? `| ${lead.email}` : ''}</p>
                    </div>
                  )}
                  <div className="expanded-info-item">
                    <label>Source</label>
                    <p>{lead.source || '-'} {lead.subSource ? ` (${lead.subSource})` : ''}</p>
                  </div>
                  <div className="expanded-info-item">
                    <label>Project/Location</label>
                    <p>{lead.project} {lead.location ? `/ ${lead.location}` : ''}</p>
                  </div>
                  <div className="expanded-info-item">
                    <label>Assigned To</label>
                    <p>{lead.assignedToUserName || 'Unassigned'} ({lead.assignedRoleLabel || lead.ownerRoleLabel || 'Pool'})</p>
                  </div>
                  {lead.nextFollowUpAt && (
                    <div className="expanded-info-item">
                      <label>Next Follow-Up</label>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', fontWeight: '500' }}>
                        <CalendarDaysIcon style={{ width: 14, height: 14, color: '#64748b' }} />
                        <span>{formatDate(lead.nextFollowUpAt)}</span>
                      </p>
                    </div>
                  )}
                  <div className="expanded-info-item full-width">
                    <label>Latest Remarks</label>
                    <p>{latestNote}</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <section className="lead-workspace">
      {/* ── Header ── */}
      <header className="lead-workspace__header">
        <div>
          <h1>{wsTitle.title}</h1>
          <p className="hide-mobile">{wsTitle.subtitle}</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => loadLeads({ silent: true })} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" className="workspace-btn workspace-btn--primary" onClick={() => setNewLeadOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <PlusCircleIcon style={{ width: 16, height: 16 }} /> New Lead
          </button>
        </div>
      </header>

      {/* ── Stats (KPI cards) - shown only for admin workspaces ── */}
      {workspaceRole !== 'TC' && workspaceRole !== 'SM' && workspaceRole !== 'SH' && workspaceRole !== 'COL' && (
        <div className="lead-workspace__stats">
          <article className="workspace-stat-card">
            <div className="stat-card__header">
              <div className="stat-card__label">Total Leads</div>
              <div className="stat-card__icon" style={{ background: '#dbeafe', color: '#2563eb' }}><UserGroupIcon style={{ width: 16, height: 16 }} /></div>
            </div>
            <div className="stat-card__value">{computedStats.totalLeads}</div>
            <div className="stat-card__change change-up">↑ {computedStats.newToday} new today</div>
          </article>
          <article className="workspace-stat-card">
            <div className="stat-card__header">
              <div className="stat-card__label">Today's Follow Ups</div>
              <div className="stat-card__icon" style={{ background: '#fef3c7', color: '#d97706' }}><PhoneIcon style={{ width: 16, height: 16 }} /></div>
            </div>
            <div className="stat-card__value" style={{ color: '#d97706' }}>{computedStats.todayFollowUps}</div>
            <div className={`stat-card__change ${computedStats.overdueFollowUps > 0 ? 'change-down' : 'change-neutral'}`}>{computedStats.overdueFollowUps} overdue</div>
          </article>
          <article className="workspace-stat-card">
            <div className="stat-card__header">
              <div className="stat-card__label">SV Scheduled</div>
              <div className="stat-card__icon" style={{ background: '#cffafe', color: '#0891b2' }}><HomeModernIcon style={{ width: 16, height: 16 }} /></div>
            </div>
            <div className="stat-card__value" style={{ color: '#0891b2' }}>{computedStats.svScheduled}</div>
            <div className="stat-card__change change-neutral">Active</div>
          </article>
          <article className="workspace-stat-card">
            <div className="stat-card__header">
              <div className="stat-card__label">SV Completed</div>
              <div className="stat-card__icon" style={{ background: '#dcfce7', color: '#16a34a' }}><CheckCircleIcon style={{ width: 16, height: 16 }} /></div>
            </div>
            <div className="stat-card__value" style={{ color: '#16a34a' }}>{computedStats.svCompleted}</div>
            <div className="stat-card__change change-neutral">This month</div>
          </article>
          <article className="workspace-stat-card">
            <div className="stat-card__header">
              <div className="stat-card__label">Missed Followups</div>
              <div className="stat-card__icon" style={{ background: '#fee2e2', color: '#dc2626' }}><NoSymbolIcon style={{ width: 16, height: 16 }} /></div>
            </div>
            <div className="stat-card__value" style={{ color: '#dc2626' }}>{computedStats.missedFollowups}</div>
            <div className="stat-card__change change-neutral">Retry needed</div>
          </article>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="lead-workspace__toolbar" ref={toolbarFiltersRef}>
        <div className="lead-workspace__toolbar-filters">
          {workspaceRole !== 'TC' && (
            <FilterDropdown
              label="Stages"
              mobileLabel="Stage"
              options={toolbarStageOptions}
              selectedValues={multiFilters.stageCodes}
              onToggle={(value) => toggleMultiFilter('stageCodes', value)}
              onClear={() => setMultiFilters((prev) => ({ ...prev, stageCodes: [] }))}
              isOpen={openFilterKey === 'stages'}
              onToggleOpen={() => setOpenFilterKey((prev) => (prev === 'stages' ? null : 'stages'))}
              onClose={() => setOpenFilterKey(null)}
            />
          )}
          <FilterDropdown
            label="Statuses"
            mobileLabel="Status"
            options={toolbarStatusOptions}
            selectedValues={multiFilters.statusCodes}
            onToggle={(value) => toggleMultiFilter('statusCodes', value)}
            onClear={() => setMultiFilters((prev) => ({ ...prev, statusCodes: [] }))}
            isOpen={openFilterKey === 'statuses'}
            onToggleOpen={() => setOpenFilterKey((prev) => (prev === 'statuses' ? null : 'statuses'))}
            onClose={() => setOpenFilterKey(null)}
          />
          <FilterDropdown
            label="Sources"
            mobileLabel="Source"
            options={sourceFilterOptions}
            selectedValues={multiFilters.sources}
            onToggle={(value) => toggleMultiFilter('sources', value)}
            onClear={() => setMultiFilters((prev) => ({ ...prev, sources: [] }))}
            isOpen={openFilterKey === 'sources'}
            onToggleOpen={() => setOpenFilterKey((prev) => (prev === 'sources' ? null : 'sources'))}
            onClose={() => setOpenFilterKey(null)}
          />
          <button type="button" className="lead-workspace__clear-filters" onClick={clearMultiFilters}>
            <span className="hide-mobile">Clear All</span>
            <span className="show-mobile">Clear</span>
          </button>

          {/* Group By Dropdown */}
          <div className="lead-filter-dropdown">
            <div
              className="lead-filter-dropdown__summary"
              style={{ cursor: 'pointer' }}
              onClick={() => setOpenFilterKey((prev) => (prev === 'groupBy' ? null : 'groupBy'))}
            >
              <span className="hide-mobile">Group by</span>
              <span className="show-mobile">Group</span>
              <span className="lead-filter-dropdown__count">
                {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label || 'None'}
              </span>
            </div>
            {openFilterKey === 'groupBy' && (
              <div className="lead-filter-dropdown__menu">
                <div className="lead-filter-dropdown__menu-head">
                  <strong>Group by</strong>
                  <button type="button" onClick={() => { setGroupBy('none'); setOpenFilterKey(null); }}>Clear</button>
                </div>
                {GROUP_BY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="lead-filter-dropdown__item">
                    <input
                      type="radio"
                      checked={groupBy === opt.value}
                      onChange={() => { setGroupBy(opt.value); setOpenFilterKey(null); }}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lead-workspace__toolbar-search">
          <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
          <input
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            placeholder="Search leads by phone or name"
          />
          <details className="lead-mobile-filters show-mobile" open={openFilterKey === 'mobile_filters'}>
            <summary
              className="lead-mobile-filters__summary"
              aria-expanded={openFilterKey === 'mobile_filters'}
              onClick={(e) => {
                e.preventDefault();
                setOpenFilterKey((prev) => (prev === 'mobile_filters' ? null : 'mobile_filters'));
              }}
            >
              <FunnelIcon style={{ width: 14, height: 14 }} />
              <span>Filters</span>
              <span className="lead-mobile-filters__count">
                {multiFilters.stageCodes.length + multiFilters.statusCodes.length + multiFilters.sources.length || 'All'}
              </span>
            </summary>
            <div className="lead-mobile-filters__menu">
              {workspaceRole !== 'TC' && (
                <div className="lead-mobile-filters__section">
                  <div className="lead-mobile-filters__head">
                    <strong>Stages</strong>
                    <button
                      type="button"
                      onClick={() => setMultiFilters((prev) => ({ ...prev, stageCodes: [] }))}
                    >
                      Clear
                    </button>
                  </div>
                  {!toolbarStageOptions.length ? (
                    <p className="lead-mobile-filters__empty">No options</p>
                  ) : (
                    toolbarStageOptions.map((opt) => (
                      <label key={`mobile-stage-${opt.value}`} className="lead-mobile-filters__item">
                        <input
                          type="checkbox"
                          checked={multiFilters.stageCodes.includes(opt.value)}
                          onChange={() => toggleMultiFilter('stageCodes', opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))
                  )}
                </div>
              )}

              <div className="lead-mobile-filters__section">
                <div className="lead-mobile-filters__head">
                  <strong>Statuses</strong>
                  <button
                    type="button"
                    onClick={() => setMultiFilters((prev) => ({ ...prev, statusCodes: [] }))}
                  >
                    Clear
                  </button>
                </div>
                {!toolbarStatusOptions.length ? (
                  <p className="lead-mobile-filters__empty">No options</p>
                ) : (
                  toolbarStatusOptions.map((opt) => (
                    <label key={`mobile-status-${opt.value}`} className="lead-mobile-filters__item">
                      <input
                        type="checkbox"
                        checked={multiFilters.statusCodes.includes(opt.value)}
                        onChange={() => toggleMultiFilter('statusCodes', opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="lead-mobile-filters__section">
                <div className="lead-mobile-filters__head">
                  <strong>Sources</strong>
                  <button
                    type="button"
                    onClick={() => setMultiFilters((prev) => ({ ...prev, sources: [] }))}
                  >
                    Clear
                  </button>
                </div>
                {!sourceFilterOptions.length ? (
                  <p className="lead-mobile-filters__empty">No options</p>
                ) : (
                  sourceFilterOptions.map((opt) => (
                    <label key={`mobile-source-${opt.value}`} className="lead-mobile-filters__item">
                      <input
                        type="checkbox"
                        checked={multiFilters.sources.includes(opt.value)}
                        onChange={() => toggleMultiFilter('sources', opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))
                )}
              </div>

              <button
                type="button"
                className="lead-mobile-filters__clear-all"
                onClick={() => {
                  clearMultiFilters();
                  setOpenFilterKey(null);
                }}
              >
                Clear All
              </button>
            </div>
          </details>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="lead-workspace__grid">
        {/* Lead List */}
        <div className="lead-workspace__list-card">
          {/* Tabs for follow-up roles */}
          {FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && (
            <div className="filter-tabs mobile-compact-tabs">
              {FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && (
                <button
                  onClick={() => setActiveTab('newhot')}
                  className={`filter-tab ${activeTab === 'newhot' ? 'active' : ''}`}
                >
                  <span className="hide-mobile">New/Hot</span>
                  <span className="show-mobile">New/Hot</span>
                </button>
              )}
              <button
                onClick={() => setActiveTab('today')}
                className={`filter-tab ${activeTab === 'today' ? 'active' : ''}`}
              >
                <span className="hide-mobile">Today&apos;s Follow Ups</span>
                <span className="show-mobile">Today</span>
              </button>
              {FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && (
                <button
                  onClick={() => setActiveTab('missed')}
                  className={`filter-tab ${activeTab === 'missed' ? 'active' : ''}`}
                >
                  <span className="hide-mobile">Missed Follow Ups</span>
                  <span className="show-mobile">Missed</span>
                </button>
              )}
              
              {FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && (
                <button
                  onClick={() => setActiveTab('reallot')}
                  className={`filter-tab ${activeTab === 'reallot' ? 'active' : ''}`}
                >
                  <span className="hide-mobile">Reallot</span>
                  <span className="show-mobile">Reallot</span>
                </button>
              )}
              {workspaceRole === 'TC' && (
                <button
                  onClick={() => setActiveTab('new')}
                  className={`filter-tab ${activeTab === 'new' ? 'active' : ''}`}
                >
                  <span className="hide-mobile">Unassigned</span>
                  <span className="show-mobile">Unassigned</span>
                </button>
              )}
              {workspaceRole === 'SH' && (
                <button
                  onClick={() => setActiveTab('sm_leads')}
                  className={`filter-tab ${activeTab === 'sm_leads' ? 'active' : ''}`}
                >
                  <span className="hide-mobile">SM Leads (Read Only)</span>
                  <span className="show-mobile">SM Leads</span>
                </button>
              )}
              {workspaceRole === 'SH' && (
                <button
                  onClick={() => setActiveTab('booked')}
                  className={`filter-tab ${activeTab === 'booked' ? 'active' : ''}`}
                  title="Your booked leads — view bookings or book the same lead again"
                >
                  <span className="hide-mobile">Booked</span>
                  <span className="show-mobile">Booked</span>
                </button>
              )}
              <small className="filter-tabs__records">
                {meta.total} records{meta.totalPages > 1 ? ` · Page ${meta.page} of ${meta.totalPages}` : ''}
              </small>
            </div>
          )}

          <div className="lead-workspace__table-wrap">
            <table className="lead-workspace__table">
              <thead>
                <tr>
                  <th className="show-mobile lead-col-toggle"></th>
                  <th className="lead-col-lead" style={{ width: 'auto' }}>Lead</th>
                  {workspaceRole !== 'SH' && <th className="hide-mobile" style={{ width: 150 }}>Contact</th>}
                  <th className="lead-col-status">Status</th>
                  {workspaceRole !== 'SH' && <th className="hide-mobile" style={{ width: 120 }}>Source/Medium</th>}
                  <th className="hide-mobile" style={{ width: 150 }}>Project/Location</th>
                  <th className="hide-tablet" style={{ width: 120 }}>Assigned</th>
                  <th className="hide-tablet" style={{ width: 150 }}>Remarks</th>
                  <th className="lead-col-followup" style={{ textAlign: 'center' }}>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={workspaceRole === 'SH' ? 7 : 10} className="lead-workspace__empty">Loading leads...</td></tr>
                )}
                {!loading && !filteredLeads.length && (
                  <tr><td colSpan={workspaceRole === 'SH' ? 7 : 10} className="lead-workspace__empty">No leads found for current filters</td></tr>
                )}
                {/* Render leads - either grouped or ungrouped */}
                {!loading && groupBy === 'none' && filteredLeads.map((lead) => renderLeadRow(lead))}
                
                {/* Grouped view */}
                {!loading && groupBy !== 'none' && groupedLeads?.map(([groupKey, groupLeads]) => {
                  const isCollapsed = collapsedGroups.has(groupKey);
                  const groupId = `${groupBy}:${groupKey}`;
                  return (
                    <React.Fragment key={groupId}>
                      {/* Group Header Row */}
                      <tr 
                        className="lead-group-header"
                        onClick={() => toggleGroup(groupKey)}
                        style={{ cursor: 'pointer', background: 'var(--bg-secondary, #f8fafc)' }}
                      >
                        <td colSpan={workspaceRole === 'SH' ? 7 : 10} style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ transition: 'transform 0.15s' }}>
                              {isCollapsed ? (
                                <ChevronRightIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
                              ) : (
                                <ChevronDownIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
                              )}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                              {groupKey}
                            </span>
                            <span style={{ 
                              fontSize: 12, 
                              fontWeight: 600, 
                              color: 'var(--accent-blue, #2563eb)', 
                              background: 'rgba(37,99,235,0.1)', 
                              borderRadius: 999, 
                              padding: '2px 10px' 
                            }}>
                              {groupLeads.length}
                            </span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
                              {isCollapsed ? 'Click to expand' : 'Click to collapse'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {/* Group Leads */}
                      {!isCollapsed && groupLeads.map((lead) => renderLeadRow(lead, groupKey))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* ── Pagination ── */}
          {!loading && meta.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '14px 0', borderTop: '1px solid var(--border-primary, #e2e8f0)' }}>
              <button
                type="button"
                className="workspace-btn workspace-btn--ghost"
                onClick={() => loadLeads({ page: meta.page - 1 })}
                disabled={meta.page <= 1}
                style={{ minWidth: 36, padding: '6px 10px', fontSize: 13 }}
              >
                ← Prev
              </button>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`ellipsis-${idx}`} style={{ padding: '4px 2px', color: 'var(--text-secondary, #94a3b8)' }}>…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className="workspace-btn workspace-btn--ghost"
                      onClick={() => loadLeads({ page: item })}
                      style={{
                        minWidth: 34,
                        padding: '6px 8px',
                        fontSize: 13,
                        fontWeight: item === meta.page ? 700 : 400,
                        background: item === meta.page ? 'var(--accent-blue-bg, #dbeafe)' : 'transparent',
                        color: item === meta.page ? 'var(--accent-blue, #2563eb)' : undefined,
                        borderRadius: 8,
                      }}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                type="button"
                className="workspace-btn workspace-btn--ghost"
                onClick={() => loadLeads({ page: meta.page + 1 })}
                disabled={meta.page >= meta.totalPages}
                style={{ minWidth: 36, padding: '6px 10px', fontSize: 13 }}
              >
                Next →
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginLeft: 8 }}>
                {meta.total} total
              </span>
            </div>
          )}
        </div>

        {/* ── Detail Panel — Corporate Standard Modal ── */}
        {selectedLead && (
          <div className="lead-workspace__modal" onClick={(e) => { if (e.target === e.currentTarget) setSelectedLeadId(null); }}>
            <div className="lead-workspace__modal-panel lead-workspace__modal-panel--lg">
              <div className="lead-workspace__modal-header">
                <div>
                  <h2>{selectedLead.fullName}</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary, #94a3b8)', marginTop: 2 }}>
                    {selectedLead.phone}{selectedLead.email ? ` · ${selectedLead.email}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedLeadReadOnly && (
                    <span
                      className="crm-badge"
                      style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', fontWeight: 700 }}
                      title="You can view this lead but cannot update it after handoff to Sales Head"
                    >
                      Read-Only
                    </span>
                  )}
                  <span className="crm-badge" style={badgeStyle(selectedLead.stageColor)}>
                    <span className="crm-badge-dot" style={{ background: badgeStyle(selectedLead.stageColor).color }} />
                    {selectedLead.stageLabel}
                  </span>
                  <span className="crm-badge" style={badgeStyle(selectedLead.statusColor)}>
                    {selectedLead.statusIcon || ''} {selectedLead.statusLabel}
                  </span>
                  <button type="button" onClick={() => setSelectedLeadId(null)}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
                </div>
              </div>
              <div className="lead-workspace__modal-body">

                {/* Two-column layout */}
                <div className="lead-detail__two-col">
                  {/* Left Column */}
                  <div className="lead-detail__left">
                    {/* Lead Details Grid */}
                    <h3 className="lead-detail__section-title">Lead Details</h3>
                    <div className="lead-detail__info-grid">
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Source</div>
                        <div className="lead-detail__info-value">{selectedLead.source || '-'}</div>
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Project(s)</div>
                        <div className="lead-detail__info-value" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(selectedLead.interestedProjects?.length > 0
                            ? selectedLead.interestedProjects.map((pid) => projectOptions.find((p) => p.id === pid)?.project_name).filter(Boolean)
                            : [selectedLead.project].filter(Boolean)
                          ).length > 0
                            ? (selectedLead.interestedProjects?.length > 0
                              ? selectedLead.interestedProjects.map((pid) => projectOptions.find((p) => p.id === pid)?.project_name).filter(Boolean)
                              : [selectedLead.project].filter(Boolean)
                            ).map((name, i) => (
                              <span key={i} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{name}</span>
                            ))
                            : '-'
                          }
                        </div>
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Location(s)</div>
                        <div className="lead-detail__info-value" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(selectedLead.interestedLocations?.length > 0
                            ? selectedLead.interestedLocations.map((lid) => {
                              const l = locationOptions.find((loc) => loc.id === lid);
                              return l ? formatLocation(l.location_name, l.city) : null;
                            }).filter(Boolean)
                            : [cleanRepeatingLocation(selectedLead.location)].filter(Boolean)
                          ).length > 0
                            ? (selectedLead.interestedLocations?.length > 0
                              ? selectedLead.interestedLocations.map((lid) => {
                                const l = locationOptions.find((loc) => loc.id === lid);
                                return l ? formatLocation(l.location_name, l.city) : null;
                              }).filter(Boolean)
                              : [cleanRepeatingLocation(selectedLead.location)].filter(Boolean)
                            ).map((name, i) => (
                              <span key={i} style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{name}</span>
                            ))
                            : '-'
                          }
                        </div>
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Budget</div>
                        <div className="lead-detail__info-value">
                          {(selectedLead.budgetMin != null || selectedLead.budgetMax != null)
                            ? `${selectedLead.budgetMin != null ? formatCurrency(selectedLead.budgetMin) : '0'} – ${selectedLead.budgetMax != null ? formatCurrency(selectedLead.budgetMax) : 'No limit'}`
                            : 'Not specified'}
                        </div>
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">WhatsApp</div>
                        <div className="lead-detail__info-value">{selectedLead.whatsappNumber || '-'}</div>
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Alternate Phone</div>
                        <div className="lead-detail__info-value">{selectedLead.alternatePhone || '-'}</div>
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Purpose / Config</div>
                        <div className="lead-detail__info-value">{selectedLead.purpose || '-'} / {selectedLead.configuration || '-'}</div>
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Campaign</div>
                        <div className="lead-detail__info-value">{selectedLead.campaignName || '-'}</div>
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Assigned To</div>
                        <div className="lead-detail__info-value" style={{ color: 'var(--accent-blue)' }}>
                          {selectedLead.assignedToUserName || 'Unassigned'}
                          {selectedLead.assignedRole && (
                            <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({ROLE_LABELS[selectedLead.assignedRole] || selectedLead.assignedRole})</small>
                          )}
                        </div>
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Last Handoff</div>
                        <div className="lead-detail__info-value">
                          {selectedLead.handoff?.fromUserName
                            ? `${selectedLead.handoff.fromUserName} → ${selectedLead.handoff.toUserName || 'Unassigned'}`
                            : 'No handoff yet'}
                        </div>
                        {selectedLead.handoff?.handedOffAt && (
                          <small>{formatDateTime(selectedLead.handoff.handedOffAt)}</small>
                        )}
                      </div>
                      <div className="lead-detail__info-item">
                        <div className="crm-form-label">Lead Number</div>
                        <div className="lead-detail__info-value">{selectedLead.leadNumber}</div>
                      </div>
                    </div>

                    {/* Behavioral Analysis (New) */}
                    {(selectedLead.motivationType || selectedLead.primaryRequirement || selectedLead.geoLat) && (
                      <>
                        <h3 className="lead-detail__section-title" style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 6 }}><SparklesIcon style={{ width: 16, height: 16 }} /> Behavioral Analysis</h3>
                        <div className="lead-detail__info-grid">
                          {selectedLead.motivationType && (
                            <div className="lead-detail__info-item">
                              <div className="crm-form-label">Buying Motivation</div>
                              <div className="lead-detail__info-value">
                                <span className="crm-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontSize: 11 }}>
                                  {selectedLead.motivationType}
                                </span>
                              </div>
                            </div>
                          )}
                          {selectedLead.primaryRequirement && (
                            <div className="lead-detail__info-item" style={{ gridColumn: 'span 2' }}>
                              <div className="crm-form-label">Primary Requirement</div>
                              <div className="lead-detail__info-value">{selectedLead.primaryRequirement}</div>
                            </div>
                          )}
                          {selectedLead.secondaryRequirement && (
                            <div className="lead-detail__info-item" style={{ gridColumn: 'span 2' }}>
                              <div className="crm-form-label">Secondary / Site Remarks</div>
                              <div className="lead-detail__info-value" style={{ fontSize: 13, lineHeight: 1.4 }}>{selectedLead.secondaryRequirement}</div>
                            </div>
                          )}
                          {selectedLead.timeSpent != null && (
                            <div className="lead-detail__info-item">
                              <div className="crm-form-label">Time Spent (mins)</div>
                              <div className="lead-detail__info-value">{selectedLead.timeSpent}</div>
                            </div>
                          )}
                          {selectedLead.geoLat && (
                            <div className="lead-detail__info-item" style={{ gridColumn: 'span 2' }}>
                              <div className="crm-form-label">Creation Location</div>
                              <div className="lead-detail__info-value">
                                <a
                                  href={`https://www.google.com/maps?q=${selectedLead.geoLat},${selectedLead.geoLong}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                                >
                                  <><MapPinIcon style={{ width: 14, height: 14 }} /> View Location on Map</>
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Quick Actions */}
                    {!selectedLead.isClosed && (
                      <>
                        <h3 className="lead-detail__section-title">Quick Actions</h3>
                        {selectedLeadReadOnly && (
                          <p style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>This lead is currently view-only for you after handoff to Sales Head.</p>
                        )}
                        <div className="lead-detail__quick-actions">
                          <button className="crm-btn crm-btn-success crm-btn-sm" onClick={handleAddNote} disabled={selectedLeadReadOnly}><PhoneIcon style={{ width: 13, height: 13, marginRight: 4 }} />Log Call</button>
                          {/* SV Recording moved to roleActions in drawer */}
                          <button className="crm-btn crm-btn-ghost crm-btn-sm" disabled={selectedLeadReadOnly}><ChatBubbleLeftIcon style={{ width: 13, height: 13, marginRight: 4 }} />WhatsApp</button>
                          <button className="crm-btn crm-btn-ghost crm-btn-sm" disabled={selectedLeadReadOnly}><IdentificationIcon style={{ width: 13, height: 13, marginRight: 4 }} />Email</button>
                          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => document.getElementById('note-input')?.focus()} disabled={selectedLeadReadOnly}><ClipboardDocumentListIcon style={{ width: 13, height: 13, marginRight: 4 }} />Add Note</button>
                          <button
                            className="crm-btn crm-btn-warning crm-btn-sm"
                            disabled={selectedLeadReadOnly}
                            onClick={() => {
                              setAssignModalOpen(true);
                              ['TC', 'SM', 'SH', 'COL'].forEach((r) => loadAssignableUsers(r));
                            }}
                          >
                            <><ArrowPathIcon style={{ width: 13, height: 13, marginRight: 4 }} /> Reassign</>
                          </button>
                        </div>
                      </>
                    )}

                    {/* Workflow Action Dropdown (replaces chips) */}
                    {!selectedLead.isClosed && roleActions.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div className="crm-form-label">Workflow Action</div>
                        <select
                          className="crm-form-select"
                          value=""
                          disabled={selectedLeadReadOnly}
                          onChange={(e) => {
                            const ac = e.target.value;
                            if (!ac) return;
                            const action = roleActions.find((a) => a.code === ac);
                            if (!action) return;
                            // Special modals (SV Done / Site Visit / Closure) go through handleAction
                            if (action.code === 'TC_SV_DONE' || action.needsSvDetails || action.needsReason || action.needsCustomerProfile) {
                              handleAction(action);
                            } else {
                              // All other actions go through the stage popup for follow-up + reason
                              setStagePopupData({
                                actionCode: action.code,
                                stageLabel: action.label,
                                followUpAt: '',
                                reason: '',
                                needsFollowUp: Boolean(action.needsFollowUp),
                              });
                              setStagePopupOpen(true);
                            }
                            e.target.value = '';
                          }}
                        >
                          <option value="">Select an action...</option>
                          {roleActions.map((action) => (
                            <option key={action.code} value={action.code}>{action.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Update Lead — Stage triggers popup, Status + Follow-up inline */}
                    <h3 className="lead-detail__section-title">Update Lead</h3>
                    <div className="lead-detail__update-grid">
                      <div>
                        <div className="crm-form-label">Stage</div>
                        <select className="crm-form-select" value="" disabled={selectedLeadReadOnly} onChange={(e) => { if (e.target.value) openStagePopup(e.target.value); }}>
                          <option value="">{selectedLead.stageLabel} (current)</option>
                          {stageTransitionOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.stageLabel}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="crm-form-label">Status</div>
                        <select className="crm-form-select" value={manualStatus} disabled={selectedLeadReadOnly} onChange={(e) => setManualStatus(e.target.value)}>
                          <option value="">Select status</option>
                          {statusOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}{o.value === selectedLead.statusCode ? ' (current)' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <div className="crm-form-label">Next Follow Up</div>
                      <CalendarPicker
                        type="date"
                        value={manualNextFollowUpAt || ''}
                        onChange={(val) => setManualNextFollowUpAt(val || '')}
                        placeholder="Select Date..."
                        className="lead-detail__calendar-input"
                        minDate={getFollowUpMinimumTime().toISOString()}
                        maxDate={followUpMaxDate(toCanonicalStatusCode(manualStatus) || selectedLead?.statusCode).toISOString()}
                        disabled={selectedLeadReadOnly}
                      />
                      <div className="lead-detail__calendar-shortcuts">
                        <button type="button" className="calendar-shortcut-btn" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt(getQuickFollowUpValue(0, 18, 0))}>Today</button>
                        <button type="button" className="calendar-shortcut-btn" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt(getQuickFollowUpValue(1, 11, 0))}>Tomorrow</button>
                        <button type="button" className="calendar-shortcut-btn" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt(getQuickFollowUpForWeekday(6, 11, 0))}>This Sat</button>
                        <button type="button" className="calendar-shortcut-btn" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt(getQuickFollowUpForWeekday(0, 11, 0))}>This Sun</button>
                        <button type="button" className="calendar-shortcut-btn calendar-shortcut-btn--clear" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt('')}><XMarkIcon style={{ width: 12, height: 12 }} /> Clear</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <div className="crm-form-label">Notes</div>
                      <textarea id="note-input" className="crm-form-input" rows={2} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add notes..." disabled={selectedLeadReadOnly} />
                    </div>
                    <div className="lead-detail__save-bar">
                      {noteDraft.trim() && (
                        <button type="button" className="workspace-btn workspace-btn--ghost" onClick={handleAddNote} disabled={selectedLeadReadOnly}><ClipboardDocumentListIcon style={{ width: 14, height: 14, marginRight: 4 }} />Save Note</button>
                      )}
                      <button
                        type="button"
                        className="workspace-btn workspace-btn--primary"
                        onClick={handleManualStatusUpdate}
                        disabled={
                          manualUpdateSaving
                          || selectedLeadReadOnly
                          || (['NEW', 'RNR', 'FOLLOW_UP', 'SV_SCHEDULED'].includes(toCanonicalStatusCode(manualStatus)) && !manualNextFollowUpAt)
                          || (Boolean(manualNextFollowUpAt) && !isFollowUpAtLeastMinutesAhead(manualNextFollowUpAt))
                        }
                      >
                        {manualUpdateSaving ? 'Saving...' : <><CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />Save Changes</>}
                      </button>
                    </div>
                  </div>

                  {/* Right Column — Activity Timeline */}
                  <div className="lead-detail__right">
                    <h3 className="lead-detail__section-title">Activity Timeline</h3>
                    <div className="crm-timeline">
                      {(selectedLead.timeline || []).length === 0 && (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                          No activity yet
                        </p>
                      )}
                      {(selectedLead.timeline || []).map((evt) => {
                        const typeClass = evt.type === 'NOTE_ADDED' ? 'tl-note'
                          : evt.type === 'STAGE_CHANGE' ? 'tl-stage'
                            : evt.type === 'STATUS_CHANGE' ? 'tl-stage'
                              : evt.type === 'REASSIGNMENT' ? 'tl-handoff'
                                : evt.type === 'CREATED' ? 'tl-system'
                                  : evt.type === 'CLOSED_WON' ? 'tl-call'
                                    : evt.type === 'CLOSED_LOST' ? 'tl-note'
                                      : 'tl-system';

                        const TypeIcon = evt.type === 'NOTE_ADDED' ? ClipboardDocumentListIcon
                          : evt.type === 'STAGE_CHANGE' ? ArrowPathIcon
                            : evt.type === 'STATUS_CHANGE' ? TagIcon
                              : evt.type === 'REASSIGNMENT' ? ArrowPathIcon
                                : evt.type === 'CREATED' ? PlusCircleIcon
                                  : evt.type === 'CLOSED_WON' ? CheckCircleIcon
                                    : evt.type === 'CLOSED_LOST' ? XMarkIcon
                                      : SparklesIcon;

                        const typeLabel = evt.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

                        return (
                          <div key={evt.id} className={`tl-item ${typeClass}`}>
                            <div className="tl-header">
                              <span className="tl-type"><TypeIcon style={{ width: 13, height: 13, marginRight: 4, verticalAlign: 'text-bottom' }} />{evt.title || typeLabel}</span>
                              <span className="tl-date">{formatDateTime(evt.at)}</span>
                            </div>
                            {evt.description && <div className="tl-text">{formatActivityDescription(evt.description, evt)}</div>}
                            {(evt.metadata?.statusRemarkResponseType || evt.metadata?.callResult || evt.metadata?.last_call_result) && (
                              <div className="tl-text" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Call Status: {(evt.metadata?.statusRemarkResponseType || evt.metadata?.callResult || evt.metadata?.last_call_result || '').replace('-', ' ')}
                              </div>
                            )}
                            <div className="tl-by">By {evt.by || 'System'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* ── Stage Transition Popup Modal ── */}
      {stagePopupOpen && (
        <div className="lead-workspace__modal" onClick={(e) => { if (e.target === e.currentTarget) { setStagePopupOpen(false); } }}>
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm" style={{ marginTop: '10vh' }}>
            <div className="lead-workspace__modal-header" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
              <div>
                <h2 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}><ArrowPathIcon style={{ width: 16, height: 16 }} />Change Stage</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {selectedLead?.stageLabel} → <strong style={{ color: '#4f46e5' }}>{stagePopupData.stageLabel}</strong>
                </div>
              </div>
              <button type="button" onClick={() => setStagePopupOpen(false)}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {/* Follow-up Date & Time */}
              <div style={{ marginBottom: 18 }}>
                <div className="crm-form-label" style={{ marginBottom: 6 }}>
                  <CalendarDaysIcon style={{ width: 14, height: 14, marginRight: 4 }} />Follow-up Date {stagePopupData.needsFollowUp && <span style={{ color: '#dc2626' }}>*</span>}
                </div>
                <CalendarPicker
                  type="date"
                  value={stagePopupData.followUpAt || ''}
                  onChange={(val) => setStagePopupData((p) => ({ ...p, followUpAt: val || '' }))}
                  placeholder="Select Date..."
                  className="lead-detail__calendar-input"
                  minDate={getFollowUpMinimumTime().toISOString()}
                  maxDate={followUpMaxDate(stagePopupAction?.targetStatusCode || selectedLead?.statusCode).toISOString()}
                />
                <div className="lead-detail__calendar-shortcuts">
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpValue(0, 18, 0) }))}>Today </button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpValue(1, 11, 0) }))}>Tomorrow</button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpForWeekday(6, 11, 0) }))}>This Sat</button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpForWeekday(0, 11, 0) }))}>This Sun</button>
                  <button type="button" className="calendar-shortcut-btn calendar-shortcut-btn--clear" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: '' }))}><XMarkIcon style={{ width: 12, height: 12 }} /> Clear</button>
                </div>
                <div className="followup-warning"><ExclamationTriangleIcon style={{ width: 14, height: 14 }} /> Follow-up date is required for this stage.</div>
              </div>

              {/* Assignee selection in Modal */}
              {stagePopupAction?.needsAssignee && (
                <div style={{ marginBottom: 18 }}>
                  <div className="crm-form-label" style={{ marginBottom: 6 }}>
                    {getAssigneeRoleForAction(stagePopupAction, workspaceRole) === 'SH' ? 'Select Sales Head (Negotiator) *' :
                      getAssigneeRoleForAction(stagePopupAction, workspaceRole) === 'SM' ? 'Select Sales Manager *' : 'Assign To *'}
                  </div>
                  <select
                    className="crm-form-select"
                    value={stagePopupData.assignToUserId}
                    onChange={(e) => setStagePopupData(p => ({ ...p, assignToUserId: e.target.value }))}
                  >
                    <option value="">
                      {getAssigneeRoleForAction(stagePopupAction, workspaceRole) === 'SH' ? 'Select Sales Head...' :
                        getAssigneeRoleForAction(stagePopupAction, workspaceRole) === 'SM' ? 'Select Sales Manager...' : 'Select user...'}
                    </option>
                    {(assignableUsers[getAssigneeRoleForAction(stagePopupAction, workspaceRole)] || [])
                      .filter((u) => {
                        const currentAssigneeId = selectedLead?.assignedToUserId || null;
                        if (String(u.id) === String(currentAssigneeId)) return false;

                        if (stagePopupAction?.code === 'TC_REASSIGN') {
                          const leadLocationId = selectedLead?.locationId || (selectedLead?.interestedLocations?.[0]) || null;
                          if (!leadLocationId) return true;
                          return Array.isArray(u.locationIds) && u.locationIds.some(locId => String(locId) === String(leadLocationId));
                        }
                        return true;
                      })
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Call Result Toggle */}
              {shouldShowCallStatus(stagePopupAction?.targetStatusCode) && (
                <div className="call-result-wrap">
                  <div className="call-result-label">Call Status</div>
                  <div className="call-result-toggle">
                    <button
                      type="button"
                      className={`call-result-btn ${stagePopupData.callResult === 'Answered' ? 'active' : ''}`}
                      onClick={() => setStagePopupData(p => ({ ...p, callResult: 'Answered' }))}
                    >
                      Answered
                    </button>
                    <button
                      type="button"
                      className={`call-result-btn ${stagePopupData.callResult === 'Not Answered' ? 'active' : ''}`}
                      onClick={() => setStagePopupData(p => ({ ...p, callResult: 'Not Answered' }))}
                    >
                      Not Answered
                    </button>
                  </div>
                </div>
              )}

              {/* Reason / Notes */}
              <div style={{ marginBottom: 18 }}>
                <div className="crm-form-label" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><ClipboardDocumentListIcon style={{ width: 14, height: 14 }} /> Reason / Notes (Optional)</div>
                <textarea
                  className="crm-form-input"
                  rows={3}
                  value={stagePopupData.reason}
                  onChange={(e) => setStagePopupData((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Enter reason for this stage change..."
                  style={{ resize: 'vertical' }}
                  autoFocus
                />
              </div>

              {/* Missing Information Block for Modal */}
              {(!selectedLeadHasLocation || !selectedLeadHasProjectFromLead) && (
                <div className="qa-drawer-ctx-block" style={{ border: '1px solid #fee2e2', background: '#fff1f1', margin: '0 0 15px', padding: '12px', borderRadius: '8px' }}>
                  <div className="qa-drawer-section" style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 8px', fontSize: 13, fontWeight: 700 }}>
                    <ExclamationTriangleIcon style={{ width: 16, height: 16 }} /> Missing Information
                  </div>
                  {!selectedLeadHasLocation && (
                    <div style={{ marginBottom: 10 }}>
                      <label className="qa-drawer-field-label" style={{ color: '#7f1d1d' }}>Primary Location *</label>
                      <select
                        className="qa-drawer-field-select"
                        style={{ width: '100%', borderColor: '#fca5a5' }}
                        value={quickMissingLocationId}
                        onChange={(e) => setQuickMissingLocationId(e.target.value)}
                      >
                        <option value="">Select Location...</option>
                        {locationOptions.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                      </select>
                    </div>
                  )}
                  {!selectedLeadHasProject && (
                    <div>
                      <label className="qa-drawer-field-label" style={{ color: '#7f1d1d' }}>Interested Project *</label>
                      <select
                        className="qa-drawer-field-select"
                        style={{ width: '100%', borderColor: '#fca5a5' }}
                        value={quickMissingProjectIds[0] || ''}
                        onChange={(e) => setQuickMissingProjectIds(e.target.value ? [e.target.value] : [])}
                      >
                        <option value="">Select Project...</option>
                        {projectOptions.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Current Lead Summary */}
              {selectedLead && (
                <div style={{ background: 'var(--bg-primary, #f8fafc)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, border: '1px solid var(--border-primary, #e2e8f0)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Lead Summary</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedLead.fullName} · {selectedLead.phone}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{selectedLead.project || 'No project'} · {selectedLead.source || 'Unknown source'}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setStagePopupOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="workspace-btn workspace-btn--primary"
                  disabled={
                    manualUpdateSaving
                    || (stagePopupData.needsFollowUp && !stagePopupData.followUpAt)
                    || (Boolean(stagePopupData.followUpAt) && !isFollowUpAtLeastMinutesAhead(stagePopupData.followUpAt))
                  }
                  onClick={handleStagePopupConfirm}
                >
                  {manualUpdateSaving ? 'Saving...' : <><CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />Confirm Stage Change</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Lead Modal ── */}
      {newLeadOpen && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel create-lead-panel">
            {/* ── Gradient Header ── */}
            <div className="create-lead-header">
              <div className="create-lead-header__title">
                <div className="create-lead-header__icon"><PlusCircleIcon style={{ width: 24, height: 24 }} /></div>
                <div>
                  <h2>Create New Lead</h2>
                  <div className="create-lead-header__subtitle">Fill in the details to register a new lead</div>
                </div>
              </div>
              <button
                type="button"
                className="create-lead-header__close"
                onClick={resetNewLeadModal}
              >
                <XMarkIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <form onSubmit={handleCreateLead}>
              <div className="create-lead-body">

                {/* ══ Section: Contact Information ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-section__header">
                    <div className="create-lead-section__icon create-lead-section__icon--contact"><UserIcon style={{ width: 20, height: 20 }} /></div>
                    <div>
                      <div className="create-lead-section__title">Contact Information</div>
                      <div className="create-lead-section__subtitle">Primary contact details of the lead</div>
                    </div>
                  </div>

                  <div className="create-lead-grid create-lead-grid--3col">
                    {/* Full Name */}
                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Full Name <span className="create-lead-field__required">*</span>
                      </label>
                      <input
                        className="create-lead-input"
                        value={newLeadForm.full_name}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, full_name: e.target.value }))}
                        required
                        placeholder="Enter contact full name"
                      />
                    </div>

                    {/* Phone */}
                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Phone <span className="create-lead-field__required">*</span>
                      </label>
                      <div className="create-lead-phone-wrap" data-dial={newLeadForm.phone_country_code}>
                        <PhoneInput
                          country="in"
                          enableSearch
                          disableCountryCode
                          disableCountryGuess
                          value={newLeadForm.phone}
                          onChange={(value, data) => {
                            // disableCountryCode → value is the national number only.
                            const dialCode = data?.dialCode ? `+${data.dialCode}` : '+91';
                            setNewLeadForm((p) => ({
                              ...p,
                              phone_country_code: dialCode,
                              phone: sanitizePhoneNumberInput(value),
                            }));
                          }}
                          inputProps={{ required: true, name: 'phone', placeholder: 'Phone number' }}
                          containerClass={`create-lead-phone-input ${phoneCheck.status === 'exists' ? 'create-lead-phone-input--error' : phoneCheck.status === 'valid' ? 'create-lead-phone-input--success' : ''}`}
                          inputClass="create-lead-phone-input__control"
                          buttonClass="create-lead-phone-input__button"
                          dropdownClass="create-lead-phone-input__dropdown"
                        />
                      </div>
                      <div className="create-lead-phone-status">
                        <div>
                          {newLeadForm.phone && !isValidPhoneForCountry(newLeadForm.phone_country_code, newLeadForm.phone)
                            ? <span className="create-lead-phone-status__msg create-lead-phone-status__msg--error"><ExclamationTriangleIcon style={{ width: 14, height: 14 }} /> Invalid number for the selected country</span>
                            : phoneCheck.status === 'exists'
                              ? <span className="create-lead-phone-status__msg create-lead-phone-status__msg--error"><ExclamationTriangleIcon style={{ width: 14, height: 14 }} /> {phoneCheck.leadInfo || 'This number already exists. New lead cannot be created.'}</span>
                              : phoneCheck.status === 'valid'
                                ? <span className="create-lead-phone-status__msg create-lead-phone-status__msg--success"><CheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Valid</span>
                                : null}
                        </div>
                        {phoneCheck.status === 'exists' && phoneCheck.duplicateLead && isClosedLostLead(phoneCheck.duplicateLead) && (
                          <button
                            type="button"
                            className={`create-lead-phone-status__btn ${reengageLeadId === phoneCheck.duplicateLead.id ? 'create-lead-phone-status__btn--active' : ''}`}
                            onClick={() => prefillFormFromDuplicateLead(phoneCheck.duplicateLead)}
                          >
                            {reengageLeadId === phoneCheck.duplicateLead.id ? <><CheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Reengage</> : 'Use this lead'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* WhatsApp Toggle */}
                    <label className="create-lead-whatsapp-toggle">
                      <input
                        type="checkbox"
                        checked={newLeadForm.whatsappSameAsPhone}
                        onChange={(e) =>
                          setNewLeadForm((p) => ({
                            ...p,
                            whatsappSameAsPhone: e.target.checked,
                            whatsapp_number: e.target.checked ? '' : p.whatsapp_number,
                          }))
                        }
                      />
                      WhatsApp
                    </label>
                  </div>

                  {/* WhatsApp Number (if different) */}
                  {!newLeadForm.whatsappSameAsPhone && (
                    <div className="create-lead-grid" style={{ marginTop: 16 }}>
                      <div className="create-lead-field">
                        <label className="create-lead-field__label">WhatsApp Number</label>
                        <input
                          className="create-lead-input"
                          value={newLeadForm.whatsapp_number}
                          onChange={(e) => setNewLeadForm((p) => ({ ...p, whatsapp_number: sanitizePhoneNumberInput(e.target.value) }))}
                          maxLength={12}
                          placeholder="Enter WhatsApp number"
                        />
                      </div>
                      <div />
                    </div>
                  )}

                  {/* Alternate Phone & Email */}
                  <div className="create-lead-grid" style={{ marginTop: 16 }}>
                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Alternate Phone <span className="create-lead-field__optional">(Optional)</span>
                      </label>
                      <div className="create-lead-phone-wrap" data-dial={newLeadForm.alternate_phone_country_code}>
                        <PhoneInput
                          country="in"
                          enableSearch
                          disableCountryCode
                          disableCountryGuess
                          value={newLeadForm.alternate_phone}
                          onChange={(value, data) => {
                            // disableCountryCode → value is the national number only.
                            const dialCode = data?.dialCode ? `+${data.dialCode}` : '+91';
                            setNewLeadForm((p) => ({
                              ...p,
                              alternate_phone_country_code: dialCode,
                              alternate_phone: sanitizePhoneNumberInput(value),
                            }));
                          }}
                          inputProps={{ name: 'alternate_phone', placeholder: 'Secondary phone number' }}
                          containerClass={`create-lead-phone-input ${altPhoneCheck.status === 'exists' ? 'create-lead-phone-input--error' : altPhoneCheck.status === 'valid' ? 'create-lead-phone-input--success' : ''}`}
                          inputClass="create-lead-phone-input__control"
                          buttonClass="create-lead-phone-input__button"
                          dropdownClass="create-lead-phone-input__dropdown"
                        />
                      </div>
                      <div className="create-lead-phone-status">
                        <div>
                          {newLeadForm.alternate_phone && !isValidPhoneForCountry(newLeadForm.alternate_phone_country_code, newLeadForm.alternate_phone)
                            ? <span className="create-lead-phone-status__msg create-lead-phone-status__msg--error"><ExclamationTriangleIcon style={{ width: 14, height: 14 }} /> Invalid number for the selected country</span>
                            : altPhoneCheck.status === 'exists'
                              ? <span className="create-lead-phone-status__msg create-lead-phone-status__msg--error"><ExclamationTriangleIcon style={{ width: 14, height: 14 }} /> {altPhoneCheck.leadInfo || 'This number already exists. New lead cannot be created.'}</span>
                              : altPhoneCheck.status === 'valid'
                                ? <span className="create-lead-phone-status__msg create-lead-phone-status__msg--success"><CheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Valid Number</span>
                                : null}
                        </div>
                        {altPhoneCheck.status === 'exists' && altPhoneCheck.duplicateLead && isClosedLostLead(altPhoneCheck.duplicateLead) && (
                          <button
                            type="button"
                            className={`create-lead-phone-status__btn ${reengageLeadId === altPhoneCheck.duplicateLead.id ? 'create-lead-phone-status__btn--active' : ''}`}
                            onClick={() => prefillFormFromDuplicateLead(altPhoneCheck.duplicateLead)}
                          >
                            {reengageLeadId === altPhoneCheck.duplicateLead.id ? <><CheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Reengage</> : 'Use this lead'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Email <span className="create-lead-field__optional">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        className="create-lead-input"
                        value={newLeadForm.email}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="email@example.com"
                      />
                    </div> */}
                  </div>
                </div>

                {/* ══ Section: Lead Classification ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-section__header">
                    <div className="create-lead-section__icon create-lead-section__icon--classify"><TagIcon style={{ width: 20, height: 20 }} /></div>
                    <div>
                      <div className="create-lead-section__title">Lead Classification</div>
                      <div className="create-lead-section__subtitle">Set status and source information</div>
                    </div>
                  </div>

                  <div className="create-lead-grid">
                    <div className="create-lead-field" style={{ gridColumn: 'span 2' }}>
                      <label className="create-lead-field__label">
                        Lead Status <span className="create-lead-field__required">*</span>
                      </label>
                      <div className="create-lead-status-chips">
                        {newLeadStatusChipOptions.map((st) => {
                          const isSelected = newLeadForm.lead_status_id === st.value || newLeadForm.lead_status_id === st.id;
                          const isTerminal = ['LOST', 'JUNK', 'SPAM'].includes(toCanonicalStatusCode(st.value));
                          return (
                            <button
                              key={st.value}
                              type="button"
                              className={`status-chip-btn ${isSelected ? 'status-chip-btn--active' : ''} ${isTerminal ? 'status-chip-btn--terminal' : ''}`}
                              disabled={workspaceRole === 'SM'}
                              onClick={() => {
                                if (workspaceRole === 'SM') return;
                                const val = st.value;
                                setNewLeadForm((p) => ({
                                  ...p,
                                  lead_status_id: p.lead_status_id === val ? '' : val,
                                  callResult: toCanonicalStatusCode(val) === 'RNR' ? 'Not Answered' : p.callResult,
                                  assignment_mode: toCanonicalStatusCode(val) === 'RNR' ? 'ME' : p.assignment_mode,
                                  assigned_to: toCanonicalStatusCode(val) === 'RNR' ? (user?.id || '') : p.assigned_to,
                                  assignment_mode_manual: toCanonicalStatusCode(val) === 'RNR' ? false : p.assignment_mode_manual,
                                }));
                              }}
                            >
                              {isSelected && <CheckCircleIcon style={{ width: 15, height: 15, flexShrink: 0 }} />}
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Closure Details for terminal statuses */}
                  {['LOST', 'JUNK', 'SPAM', 'COLD_LOST'].includes(selectedNewLeadStatusCode) && (
                    <div className="create-lead-closure">
                      <div className="create-lead-closure__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ExclamationTriangleIcon style={{ width: 18, height: 18 }} /> Closure Details</div>
                      <div className="create-lead-grid">
                        <div className="create-lead-field">
                          <label className="create-lead-field__label">
                            Closure Reason <span className="create-lead-field__required">*</span>
                          </label>
                          <select
                            className="create-lead-select"
                            value={newLeadForm.closure_reason_id}
                            onChange={(e) => setNewLeadForm((p) => ({ ...p, closure_reason_id: e.target.value }))}
                          >
                            <option value="">Select reason...</option>
                            {closureReasons.map((r) => (
                              <option key={r.id} value={r.id}>{r.reason_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ══ Section: Location & Source ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-section__header">
                    <div className="create-lead-section__icon create-lead-section__icon--location"><MapPinIcon style={{ width: 20, height: 20 }} /></div>
                    <div>
                      <div className="create-lead-section__title">Location, Projects &amp; Source</div>
                      <div className="create-lead-section__subtitle">Where the lead is interested and how they found us</div>
                    </div>
                  </div>

                  {(workspaceRole === 'SM' || ['NEW', 'FOLLOW_UP', 'SV_SCHEDULED'].includes(selectedNewLeadStatusCode)) && (
                    <div className="create-lead-grid">
                      {/* Location */}
                      <div className="create-lead-field">
                        <label className="create-lead-field__label">
                          Location <span className="create-lead-field__required">*</span>
                        </label>
                        <select
                          className="create-lead-select"
                          value={newLeadForm.location_id}
                          onChange={(e) => setNewLeadForm((p) => ({
                            ...p,
                            location_id: e.target.value,
                            location_ids: e.target.value ? [e.target.value] : [],
                            project_ids: [],
                          }))}
                          required
                        >
                          <option value="">Select location</option>
                          {locationOptions.map((loc) => (
                            <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Project Multi-Select */}
                      <div className="create-lead-field">
                        <label className="create-lead-field__label">
                          Project <span className="create-lead-field__required">*</span>
                        </label>
                        <div ref={projectDropdownRef} style={{ position: 'relative' }}>
                          <div
                            className="create-lead-project-trigger"
                            onClick={() => setProjectDropdownOpen((p) => !p)}
                          >
                            {selectedProjectNames.length === 0 && <span className="create-lead-project-trigger__placeholder">Select projects...</span>}
                            {selectedProjectNames.map((name, i) => (
                              <span key={i} className="create-lead-project-chip">
                                {name}
                                <span
                                  className="create-lead-project-chip__remove"
                                  onClick={(ev) => { ev.stopPropagation(); toggleProject((newLeadForm.project_ids || [])[i]); }}
                                >×</span>
                              </span>
                            ))}
                          </div>

                          {projectDropdownOpen && (
                            <div className="create-lead-project-dropdown" style={{ zIndex: 100 }}>
                              <div className="create-lead-project-dropdown__search">
                                <input
                                  type="text"
                                  placeholder="Search projects..."
                                  value={projectSearch}
                                  onChange={(e) => setProjectSearch(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="create-lead-project-dropdown__list">
                                {filteredProjectOptions.map((project) => (
                                  <label key={project.id} className="create-lead-project-dropdown__item">
                                    <input
                                      type="checkbox"
                                      checked={(newLeadForm.project_ids || []).includes(project.id)}
                                      onChange={() => toggleProject(project.id)}
                                    />
                                    <span>
                                      {getProjectDisplayName(project)}
                                    </span>
                                  </label>
                                ))}
                                {filteredProjectOptions.length === 0 && (
                                  <div className="create-lead-project-dropdown__empty">No projects found</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Source & Sub-Source */}
                  <div className="create-lead-grid" style={{ marginTop: 16 }}>
                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Lead Source <span className="create-lead-field__required">*</span>
                      </label>
                      <select
                        className="create-lead-select"
                        value={newLeadForm.lead_source_id}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_source_id: e.target.value, lead_sub_source_id: '' }))}
                        required
                      >
                        <option value="">Select lead source</option>
                        {sourceOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.source_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Lead Sub-Source {(workspaceRole === 'TC' || (workspaceRole === 'SM' && selectedSourceSubSources.length > 0)) && <span className="create-lead-field__required">*</span>}
                      </label>
                      <select
                        className={`create-lead-select ${workspaceRole === 'TC' && newLeadForm.lead_source_id && !newLeadForm.lead_sub_source_id ? 'create-lead-select--highlight' : ''}`}
                        value={newLeadForm.lead_sub_source_id}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_sub_source_id: e.target.value }))}
                        disabled={!newLeadForm.lead_source_id || !selectedSourceSubSources.length}
                        required={workspaceRole === 'TC' || (workspaceRole === 'SM' && selectedSourceSubSources.length > 0)}
                      >
                        <option value="">Select sub-source</option>
                        {selectedSourceSubSources.map((s) => (
                          <option key={s.id} value={s.id}>{s.sub_source_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ══ Section: Follow-Up & Assignment ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-grid">
                    {workspaceRole === 'SM' && smStatusNeedsAssignee && (
                      <div className="create-lead-field" style={{ gridColumn: 'span 2' }}>
                        <label className="create-lead-field__label">
                          Sales Head <span className="create-lead-field__required">*</span>
                        </label>
                        <select
                          className="create-lead-select"
                          value={newLeadForm.assigned_to}
                          onChange={(e) => setNewLeadForm((p) => ({ ...p, assigned_to: e.target.value }))}
                          required
                        >
                          <option value="">Select Sales Head</option>
                          {(assignableUsers.SH || []).map((u) => (
                            <option key={u.id} value={u.id}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {((workspaceRole === 'TC' && ['NEW', 'RNR', 'SV_SCHEDULED', 'FOLLOW_UP'].includes(selectedNewLeadStatusCode))
                      || (workspaceRole === 'SM' && smStatusNeedsFollowUp)) && (
                        <div className="create-lead-field" style={{ gridColumn: 'span 2' }}>
                          <label className="create-lead-field__label">
                            Next Follow-Up Date <span className="create-lead-field__required">*</span>
                          </label>
                          <div className="create-lead-followup-chips" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
                            {newLeadFollowUpShortcutOptions.map((shortcut) => (
                              <button
                                key={shortcut.label}
                                type="button"
                                className="calendar-shortcut-btn"
                                style={{ width: '100%', minWidth: 0, whiteSpace: 'nowrap' }}
                                onClick={() => setNewLeadForm((p) => ({ ...p, nextFollowUpAt: shortcut.value }))}
                              >
                                {shortcut.label}
                              </button>
                            ))}
                          </div>
                          <CalendarPicker
                            type="date"
                            value={newLeadForm.nextFollowUpAt}
                            onChange={(val) => setNewLeadForm((p) => ({ ...p, nextFollowUpAt: val }))}
                            placeholder="Select follow-up date..."
                            minDate={getFollowUpMinimumTime().toISOString()}
                            maxDate={followUpMaxDate(selectedNewLeadStatusCode).toISOString()}
                          />
                        </div>
                      )}

                    {/* Call Status Selection for New Lead */}
                    {shouldShowCreateCallStatus && (
                      <div className="create-lead-field" style={{ gridColumn: 'span 2' }}>
                        <div className="call-result-label">Call Status <span className="create-lead-field__required">*</span></div>
                        <div className="call-result-toggle">
                          <button
                            type="button"
                            className={`call-result-btn ${newLeadForm.callResult === 'Answered' ? 'active' : ''}`}
                            onClick={() => setNewLeadForm((p) => ({ ...p, callResult: 'Answered' }))}
                          >
                            Answered
                          </button>
                          <button
                            type="button"
                            className={`call-result-btn ${newLeadForm.callResult === 'Not Answered' ? 'active' : ''}`}
                            onClick={() => setNewLeadForm((p) => ({ ...p, callResult: 'Not Answered' }))}
                          >
                            Not Answered
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {workspaceRole === 'SM' && null}

                {/* ══ Section: Notes & Remarks ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-section__header">
                    <div className="create-lead-section__icon create-lead-section__icon--notes"><PencilSquareIcon style={{ width: 20, height: 20 }} /></div>
                    <div>
                      <div className="create-lead-section__title">Notes &amp; Remarks{createLeadNeedsRemark ? ' *' : ''}</div>
                      <div className="create-lead-section__subtitle">Add quick tags or custom notes</div>
                    </div>
                  </div>

                  <div className="create-lead-chips">
                    {remarksLoading ? (
                      <div className="create-lead-remarks-loading">
                        <div className="create-lead-shimmer" />
                        <div className="create-lead-shimmer" />
                        <div className="create-lead-shimmer" />
                      </div>
                    ) : (
                      (() => {
                        const chips = newLeadStatusRemarks.length > 0
                          ? newLeadStatusRemarks
                          : NEW_LEAD_REMARK_CHIPS.map(c => ({ remark_text: c }));

                        return chips.map((remark, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={`create-lead-chip ${newLeadForm.remark.trim() === remark.remark_text ? 'create-lead-chip--active' : ''}`}
                            onClick={() => {
                              const text = remark.remark_text;
                              setNewLeadForm((p) => ({ ...p, remark: p.remark.trim() === text ? '' : text }));
                            }}
                          >
                            + {remark.remark_text}
                          </button>
                        ))
                      })()
                    )}
                  </div>

                  <textarea
                    className="create-lead-textarea"
                    rows={2}
                    value={newLeadForm.remark}
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, remark: e.target.value }))}
                    required={createLeadNeedsRemark}
                    placeholder="Add notes or remarks about the lead..."
                  />
                </div>

              </div>

              {/* ── Footer ── */}
              <div className="create-lead-footer">
                {workspaceRole === 'TC' && selectedNewLeadStatusCode !== 'RNR' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginRight: 'auto' }}>
                    <div className="call-result-label" style={{ marginBottom: 0 }}>Lead Assignment</div>
                    <div className="call-result-toggle" style={{ marginBottom: 0 }}>
                      <button
                        type="button"
                        className={`call-result-btn ${newLeadForm.assignment_mode !== 'POOL' ? 'active' : ''}`}
                        onClick={() => setNewLeadForm((p) => ({ ...p, assignment_mode: 'ME', assigned_to: user?.id || '', assignment_mode_manual: true }))}
                        disabled={!tcCanSelfAssignSelectedLocation && selectedCreateLocationIds.length > 0}
                        title={!tcCanSelfAssignSelectedLocation && selectedCreateLocationIds.length > 0 ? 'Selected location is not mapped to you' : undefined}
                      >
                        Assign to me
                      </button>
                      <button
                        type="button"
                        className={`call-result-btn ${newLeadForm.assignment_mode === 'POOL' ? 'active' : ''}`}
                        onClick={() => setNewLeadForm((p) => ({ ...p, assignment_mode: 'POOL', assigned_to: '', assignment_mode_manual: true }))}
                      >
                        Unassigned
                      </button>
                    </div>
                    {!tcCanSelfAssignSelectedLocation && selectedCreateLocationIds.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Selected location is outside your mapped locations. Lead will go to unassigned.
                      </div>
                    )}
                  </div>
                )}

                {workspaceRole === 'TC' && selectedNewLeadStatusCode === 'RNR' && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 'auto' }}>
                    RNR leads are auto-assigned to you.
                  </div>
                )}

                <button
                  type="button"
                  className="create-lead-footer__cancel"
                  onClick={resetNewLeadModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="create-lead-footer__submit"
                  disabled={
                    creating
                    || !newLeadValidation.isValid
                    || ((phoneCheck.status === 'exists' || altPhoneCheck.status === 'exists')
                      && ![
                        phoneCheck.duplicateLead?.id,
                        altPhoneCheck.duplicateLead?.id,
                      ].filter(Boolean).includes(reengageLeadId))
                  }
                >
                  {creating ? 'Creating...' : <><CheckIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Create Lead</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Record Site Visit Modal (SM) ── */}
      {recordSvModalOpen && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm">
            <div className="lead-workspace__modal-header" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}>
              <h2 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}><HomeModernIcon style={{ width: 18, height: 18 }} />Record Site Visit</h2>
              <button type="button" style={{ color: '#fff' }} onClick={() => setRecordSvModalOpen(false)}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
            </div>

            <div className="assign-modal__body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <strong>{selectedLead?.fullName}</strong> ({selectedLead?.leadNumber})
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Log a visit analysis for this lead.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label>
                  Date *
                  <CalendarPicker
                    type="date"
                    value={recordSvForm.svDate ? new Date(recordSvForm.svDate).toISOString() : ''}
                    onChange={(val) => setRecordSvForm(p => ({ ...p, svDate: val ? val.split('T')[0] : '' }))}
                  />
                </label>
                <label>
                  Time Spent (Mins)
                  <input type="number" placeholder="Duration" value={recordSvForm.timeSpent} onChange={(e) => setRecordSvForm(p => ({ ...p, timeSpent: e.target.value }))} style={{ width: '100%' }} />
                </label>
              </div>

              <label style={{ marginBottom: 14 }}>
                Project Visited *
                <select value={recordSvForm.svProjectId} onChange={(e) => setRecordSvForm(p => ({ ...p, svProjectId: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Select Project...</option>
                  {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </label>

              <label style={{ marginBottom: 14 }}>
                Select Sales Head (Negotiator) *
                <select
                  value={recordSvForm.assignToUserId}
                  onChange={(e) => setRecordSvForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="">Select Sales Head...</option>
                  {(assignableUsers.SH || []).map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}</option>
                  ))}
                </select>
                <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>
                  Any Sales Manager can log visit details; lead ownership does not move to that SM. Lead will transfer to selected Sales Head.
                </small>
              </label>

              <label style={{ marginBottom: 14 }}>
                Buying Motivation *
                <select value={recordSvForm.motivationType} onChange={(e) => setRecordSvForm(p => ({ ...p, motivationType: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Select motivation...</option>
                  <option value="Necessity">Necessity</option>
                  <option value="Comfort">Comfort</option>
                  <option value="Emotional">Emotional</option>
                  <option value="Prestige">Prestige</option>
                  <option value="Thrill">Thrill / Investment</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label>
                  Budget Min
                  <input
                    type="number"
                    min="0"
                    value={recordSvForm.budgetMin}
                    onChange={(e) => setRecordSvForm((p) => ({ ...p, budgetMin: e.target.value }))}
                    style={{ width: '100%' }}
                    placeholder="Minimum budget"
                  />
                </label>
                <label>
                  Budget Max
                  <input
                    type="number"
                    min="0"
                    value={recordSvForm.budgetMax}
                    onChange={(e) => setRecordSvForm((p) => ({ ...p, budgetMax: e.target.value }))}
                    style={{ width: '100%' }}
                    placeholder="Maximum budget"
                  />
                </label>
              </div>

              <label style={{ marginBottom: 14 }}>
                Primary Requirement
                <input type="text" value={recordSvForm.primaryRequirement} onChange={(e) => setRecordSvForm(p => ({ ...p, primaryRequirement: e.target.value }))} placeholder="Key highlight" style={{ width: '100%' }} />
              </label>

              <label style={{ marginBottom: 14 }}>
                Secondary Requirements / Remarks
                <textarea rows={2} value={recordSvForm.secondaryRequirement} onChange={(e) => setRecordSvForm(p => ({ ...p, secondaryRequirement: e.target.value }))} placeholder="Additional details..." style={{ width: '100%' }} />
              </label>



              <div className="assign-modal__footer">
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setRecordSvModalOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="workspace-btn workspace-btn--primary"
                  onClick={handleRecordSvSubmit}
                  disabled={!recordSvForm.assignToUserId || !recordSvForm.svProjectId || !recordSvForm.motivationType || recordSvForm.budgetMin === '' || recordSvForm.budgetMax === ''}
                >
                  <><CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />Record Visit</>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Lead Modal ── */}
      {assignModalOpen && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm">
            <div className="lead-workspace__modal-header">
              <h2>Reassign Lead</h2>
              <button type="button" onClick={() => setAssignModalOpen(false)}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
            </div>

            <div className="assign-modal__body">
              <p className="assign-modal__lead">
                <strong>{selectedLead?.fullName}</strong> ({selectedLead?.leadNumber})
              </p>
              <p className="assign-modal__current">
                Currently assigned to: <strong>{selectedLead?.assignedToUserName || 'Unassigned'}</strong>
              </p>

              <label>
                Assign to:
                <select value={assignTarget.userId} onChange={(e) => setAssignTarget((p) => ({ ...p, userId: e.target.value }))}>
                  <option value="">Select user...</option>
                  {(workspaceRole === 'TC' ? ['TC'] : ['TC', 'SM', 'SH', 'COL']).map((role) => {
                    const users = assignableUsers[role] || [];
                    if (!users.length) return null;
                    return (
                      <optgroup key={role} label={ROLE_LABELS[role] || role}>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </label>

              <label>
                Note (optional):
                <textarea
                  rows={2}
                  value={assignTarget.note}
                  onChange={(e) => setAssignTarget((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Reason for reassignment"
                />
              </label>

              <div className="assign-modal__footer">
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setAssignModalOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="workspace-btn workspace-btn--primary"
                  onClick={handleAssignLead}
                  disabled={!assignTarget.userId}
                >
                  Assign Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SV Done Modal ── */}
      {svDoneModalOpen && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm">
            <div className="lead-workspace__modal-header">
              <h2>Mark Site Visit Done</h2>
              <button type="button" onClick={() => setSvDoneModalOpen(false)}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
            </div>

            <div className="assign-modal__body">
              <p className="assign-modal__lead">
                <strong>{selectedLead?.fullName}</strong> ({selectedLead?.leadNumber})
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Marking SV Done will transfer this lead to the selected Sales Manager. You will lose access to this lead.
              </p>

              <label>
                Sales Manager *
                <select
                  value={svDoneForm.assignToUserId}
                  onChange={(e) => setSvDoneForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                  required
                >
                  <option value="">Select Sales Manager...</option>
                  {(assignableUsers.SM || []).map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
              </label>

              <label>
                Date of Site Visit *
                <CalendarPicker
                  type="date"
                  value={svDoneForm.svDate ? new Date(svDoneForm.svDate).toISOString() : ''}
                  onChange={(val) => setSvDoneForm(p => ({ ...p, svDate: val ? val.split('T')[0] : '' }))}
                />
              </label>

              <label>
                Project Visited *
                <select
                  value={svDoneForm.svProjectId}
                  onChange={(e) => setSvDoneForm((p) => ({ ...p, svProjectId: e.target.value }))}
                  required
                >
                  <option value="">Select Project...</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_name}</option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Budget Min
                  <input
                    type="number"
                    min="0"
                    value={svDoneForm.budgetMin}
                    onChange={(e) => setSvDoneForm((p) => ({ ...p, budgetMin: e.target.value }))}
                    style={{ width: '100%' }}
                    placeholder="Minimum budget"
                  />
                </label>
                <label>
                  Budget Max
                  <input
                    type="number"
                    min="0"
                    value={svDoneForm.budgetMax}
                    onChange={(e) => setSvDoneForm((p) => ({ ...p, budgetMax: e.target.value }))}
                    style={{ width: '100%' }}
                    placeholder="Maximum budget"
                  />
                </label>
              </div>

              <label>
                Notes (optional)
                <textarea
                  rows={2}
                  value={svDoneForm.note}
                  onChange={(e) => setSvDoneForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Site visit remarks..."
                />
              </label>

              <div className="assign-modal__footer">
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setSvDoneModalOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="workspace-btn workspace-btn--primary"
                  onClick={handleSvDoneSubmit}
                  disabled={!svDoneForm.assignToUserId || !svDoneForm.svDate || !svDoneForm.svProjectId || svDoneForm.budgetMin === '' || svDoneForm.budgetMax === ''}
                >
                  <><CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />Confirm SV Done & Handoff</>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Closure Reason Modal ── */}
      {closureModalOpen && closureModalAction && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm">
            <div className="lead-workspace__modal-header">
              <h2>{closureModalAction.label}</h2>
              <button type="button" onClick={() => { setClosureModalOpen(false); setClosureModalAction(null); }}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
            </div>

            <div className="assign-modal__body">
              <p className="assign-modal__lead">
                <strong>{selectedLead?.fullName}</strong> ({selectedLead?.leadNumber})
              </p>

              {closureModalAction.code?.includes('JUNK') || closureModalAction.code?.includes('WRONG_NUMBER') ? (
                <div style={{ background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--accent-red)' }}>
                  <ExclamationTriangleIcon style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'text-bottom' }} /> Warning: Marking as {closureModalAction.label.replace('Mark ', '')} will increment the strike counter.
                  After 3 strikes, the lead will be permanently deactivated.
                  {selectedLead && <span> (Current strikes: {selectedLead.junkStrikeCount || 0}/3)</span>}
                </div>
              ) : null}

              <label>
                Reason *
                <select
                  value={closureForm.closureReasonId}
                  onChange={(e) => setClosureForm((p) => ({ ...p, closureReasonId: e.target.value }))}
                >
                  <option value="">Select reason...</option>
                  {closureReasons.map((r) => (
                    <option key={r.id} value={r.id}>{r.reason_name}</option>
                  ))}
                </select>
              </label>

              <label>
                Additional Remarks
                <textarea
                  rows={2}
                  value={closureForm.reason}
                  onChange={(e) => setClosureForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Additional details..."
                />
              </label>

              <div className="assign-modal__footer">
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => { setClosureModalOpen(false); setClosureModalAction(null); }}>Cancel</button>
                <button
                  type="button"
                  className={`workspace-btn workspace-btn--${closureModalAction.tone === 'danger' ? 'danger' : 'primary'}`}
                  onClick={handleClosureSubmit}
                  disabled={!closureForm.closureReasonId && !closureForm.reason.trim()}
                >
                  Confirm {closureModalAction.label}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Customer Profile Modal (SH Close Won) ── */}
      {customerProfileOpen && (
        <div className="lead-workspace__modal lead-workspace__modal--stacked" onClick={() => setCustomerProfileOpen(false)}>
          <div className="lead-workspace__modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', padding: '18px 24px', borderRadius: '12px 12px 0 0', color: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircleIcon style={{ width: 16, height: 16 }} />Close Won — Customer Profile</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.85 }}>Fill customer details before creating booking</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomerProfileOpen(false)}
                aria-label="Close customer profile modal"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                <XMarkIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Booking Details */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><HomeModernIcon style={{ width: 14, height: 14 }} />Booking Details</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Buyer Name
                  <input type="text" value={customerProfileForm.buyer_name} onChange={(e) => setCustomerProfileForm(p => ({ ...p, buyer_name: e.target.value }))} placeholder="Enter buyer name (if different from lead)" style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Booking Date *
                  <input type="date" value={customerProfileForm.bookingDate || ''} onChange={(e) => setCustomerProfileForm(p => ({ ...p, bookingDate: e.target.value }))} style={{ width: '100%', marginTop: 4 }} required />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Location
                  <select value={customerProfileForm.bookingLocationId} onChange={(e) => { setCustomerProfileForm(p => ({ ...p, bookingLocationId: e.target.value, bookingProjectId: '' })); setAvailableUnits([]); }} style={{ width: '100%', marginTop: 4 }}>
                    <option value="">— Select Location —</option>
                    {locationOptions.filter(l => l.is_active !== false).map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Project
                  <select value={customerProfileForm.bookingProjectId} onChange={(e) => {
                    const pid = e.target.value;
                    setCustomerProfileForm(p => ({ ...p, bookingProjectId: pid, bookingPhaseId: '', inventoryUnitId: '' }));
                    if (pid) {
                      projectPhaseApi.dropdown(pid).then(resp => setAvailablePhases(resp.data?.data || resp.data || [])).catch(() => setAvailablePhases([]));
                      inventoryUnitApi.getDropdown({ project_id: pid }).then(resp => setAvailableUnits(resp.data || [])).catch(() => setAvailableUnits([]));
                    } else { setAvailablePhases([]); setAvailableUnits([]); }
                  }} style={{ width: '100%', marginTop: 4 }}>
                    <option value="">— Select Project —</option>
                    {projectOptions.filter(p => p.is_active !== false && (!customerProfileForm.bookingLocationId || p.location_id === customerProfileForm.bookingLocationId)).map(proj => (
                      <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {customerProfileForm.bookingProjectId && availablePhases.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Phase
                    <select value={customerProfileForm.bookingPhaseId} onChange={(e) => {
                      const phId = e.target.value;
                      setCustomerProfileForm(p => ({ ...p, bookingPhaseId: phId, inventoryUnitId: '' }));
                      inventoryUnitApi.getDropdown({ project_id: customerProfileForm.bookingProjectId, phase_id: phId || undefined })
                        .then(resp => setAvailableUnits(resp.data || []))
                        .catch(() => setAvailableUnits([]));
                    }} style={{ width: '100%', marginTop: 4 }}>
                      <option value="">— All phases —</option>
                      {availablePhases.map(ph => (
                        <option key={ph.id} value={ph.id}>{ph.phase_name}{ph.phase_code ? ` (${ph.phase_code})` : ''}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {availableUnits.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Available Unit / Plot
                    <select value={customerProfileForm.inventoryUnitId} onChange={(e) => setCustomerProfileForm(p => ({ ...p, inventoryUnitId: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                      <option value="">— Select Unit / Plot —</option>
                      {availableUnits.filter(u => u.unit_status === 'Available' && (!customerProfileForm.bookingPhaseId || u.phase_id === customerProfileForm.bookingPhaseId)).map(unit => (
                        <option key={unit.id} value={unit.id}>
                          {unit.unit_number}{unit.configuration ? ` — ${unit.configuration}` : ''}{unit.unit_area ? ` — ${unit.unit_area} ${unit.area_unit || 'sq.ft.'}` : ''}{unit.total_price ? ` — ₹${Number(unit.total_price).toLocaleString('en-IN')}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Payment Plan *
                <select value={customerProfileForm.paymentPlanId} onChange={(e) => setCustomerProfileForm(p => ({ ...p, paymentPlanId: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">— Select Payment Plan —</option>
                  {paymentPlans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.plan_name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Personal Details */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><UserIcon style={{ width: 14, height: 14 }} />Personal Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Date of Birth *
                  <input type="date" value={customerProfileForm.date_of_birth} onChange={(e) => setCustomerProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Marital Status
                  <select value={customerProfileForm.marital_status} onChange={(e) => setCustomerProfileForm(p => ({ ...p, marital_status: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                    <option value="">Select...</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </label>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Purchase Type
                <select value={customerProfileForm.purchase_type} onChange={(e) => setCustomerProfileForm(p => ({ ...p, purchase_type: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                  <option value="">Select...</option>
                  <option value="Investment">Investment</option>
                  <option value="Self Use">Self Use</option>
                  <option value="Rental">Rental</option>
                  <option value="Gift">Gift</option>
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Occupation *
                  <input type="text" value={customerProfileForm.occupation} onChange={(e) => setCustomerProfileForm(p => ({ ...p, occupation: e.target.value }))} placeholder="e.g. Business, Salaried, Professional" style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Current Post
                  <input type="text" value={customerProfileForm.current_post} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_post: e.target.value }))} placeholder="e.g. Manager, Director" style={{ width: '100%', marginTop: 4 }} />
                </label>
              </div>

              {/* Identity */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><IdentificationIcon style={{ width: 14, height: 14 }} />Identity Documents</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  PAN Number
                  <input type="text" maxLength={10} value={customerProfileForm.pan_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, pan_number: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" style={{ width: '100%', marginTop: 4, textTransform: 'uppercase' }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Aadhar Number *
                  <input type="text" maxLength={12} value={customerProfileForm.aadhar_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, aadhar_number: e.target.value.replace(/\D/g, '') }))} placeholder="1234 5678 9012" style={{ width: '100%', marginTop: 4 }} />
                </label>
              </div>

              {/* Current Address */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><MapPinIcon style={{ width: 14, height: 14 }} />Current Address *</div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Address
                <textarea rows={2} value={customerProfileForm.current_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_address: e.target.value }))} placeholder="Street address..." style={{ width: '100%', marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Area / Locality
                <input type="text" value={customerProfileForm.current_area} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_area: e.target.value }))} placeholder="e.g. MG Road, Koramangala" style={{ width: '100%', marginTop: 4 }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  City
                  <input type="text" value={customerProfileForm.current_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_city: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  State
                  <select value={customerProfileForm.current_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_state: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                    <option value="">— Select State —</option>
                    {INDIAN_STATES_UTS.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pincode
                  <input type="text" maxLength={6} value={customerProfileForm.current_pincode} onChange={handlePincodeChange} style={{ width: '120px', marginTop: 4 }} placeholder="6 digits" />
                </label>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><MapPinIcon style={{ width: 14, height: 14 }} />Permanent Address</div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Address
                <textarea rows={2} value={customerProfileForm.permanent_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_address: e.target.value }))} placeholder="Street address..." style={{ width: '100%', marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Area / Locality
                <input type="text" value={customerProfileForm.permanent_area} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_area: e.target.value }))} placeholder="e.g. MG Road, Koramangala" style={{ width: '100%', marginTop: 4 }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  City
                  <input type="text" value={customerProfileForm.permanent_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_city: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  State
                  <select value={customerProfileForm.permanent_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_state: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                    <option value="">— Select State —</option>
                    {INDIAN_STATES_UTS.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pincode
                  <input type="text" maxLength={6} value={customerProfileForm.permanent_pincode} onChange={handlePermanentPincodeChange} style={{ width: '120px', marginTop: 4 }} placeholder="6 digits" />
                </label>
              </div>


              {/* Collection Manager Assignment */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><UserIcon style={{ width: 14, height: 14 }} />Assign Collection Manager *</div>
              <select value={customerProfileForm.assignToUserId} onChange={(e) => setCustomerProfileForm(p => ({ ...p, assignToUserId: e.target.value }))} style={{ width: '100%' }}>
                <option value="">Select Collection Manager...</option>
                {(assignableUsers['COL'] || []).map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}</option>
                ))}
              </select>

              {/* Notes */}
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Notes
                <textarea rows={2} value={customerProfileForm.note} onChange={(e) => setCustomerProfileForm(p => ({ ...p, note: e.target.value }))} placeholder="Additional remarks..." style={{ width: '100%', marginTop: 4 }} />
              </label>

              <div className="assign-modal__footer" style={{ marginTop: 8 }}>
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setCustomerProfileOpen(false)}>Cancel</button>
                <button type="button" className="workspace-btn workspace-btn--success" onClick={handleCustomerProfileSubmit} disabled={manualUpdateSaving}>
                  {manualUpdateSaving ? 'Processing...' : <><CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />Approve Booking & Create Customer</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Drawer Modal */}
      {quickActionLead && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true" onClick={() => {
          setQuickActionLead(null);
          resetQuickWorkflowForm();
        }}>
          <div className="qa-modal-panel" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Handle */}
            <div className="qa-drawer-handle" />

            {/* ── Drawer Header: Avatar + Name + Meta + Close ── */}
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div
                  className="qa-drawer-avatar"
                >
                  {(quickActionLead.fullName || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="qa-drawer-name">{quickActionLead.fullName}</div>
                  {quickActionLeadReadOnly && (
                    <div>
                      <span
                        className="crm-badge"
                        style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', fontWeight: 700, marginTop: 4 }}
                        title="You can view this lead but cannot update it after handoff to Sales Head"
                      >
                        Read-Only
                      </span>
                    </div>
                  )}
                  <div className="qa-drawer-meta">
                    {quickActionLead.phone}
                    {quickActionLead.project ? ` · ${quickActionLead.project}` : ''}
                    {quickActionLead.location ? ` - ${quickActionLead.location}` : ''}
                  </div>
                  <div className="qa-drawer-budget">
                    {quickActionLead.source || 'No Source'}
                    {quickActionLead.subSource ? ` · ${quickActionLead.subSource}` : ''}
                    {(quickActionLead.budgetMin || quickActionLead.budgetMax) && (
                      <span style={{ opacity: 0.8, marginLeft: 8 }}>
                        ({quickActionLead.budgetMin ? formatCurrency(quickActionLead.budgetMin) : ''}{quickActionLead.budgetMax ? `–${formatCurrency(quickActionLead.budgetMax)}` : ''})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="qa-header-comms">
                  <button
                    className="qa-header-icon-btn"
                    title="Call Now"
                    onClick={() => window.open(`tel:${quickActionLead.phone}`)}
                  >
                    <PhoneIcon style={{ width: 18, height: 18 }} />
                  </button>
                  <button
                    className="qa-header-icon-btn"
                    title="WhatsApp"
                    onClick={() => window.open(`https://wa.me/${(quickActionLead.whatsappNumber || quickActionLead.phone || '').replace(/\D/g, '')}`, '_blank')}
                  >
                    <ChatBubbleLeftIcon style={{ width: 18, height: 18 }} />
                  </button>
                </div>
                <button
                  className="qa-drawer-close"
                  onClick={() => {
                    setQuickActionLead(null);
                    resetQuickWorkflowForm();
                  }}
                >
                  <XMarkIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>

            {/* ── Scrollable Drawer Body ── */}
            <div className="qa-drawer-body">
              {/* ── Latest Remark Context Card ── */}
              {(() => {
                const lastAct = quickActionActivities.find(act => getUserRemarkText(act));
                if (!lastAct) return null;
                const remark = getUserRemarkText(lastAct);
                const statusLabel = getRemarkHistoryStatusLabel(lastAct, workflowConfig);
                const callStatus = lastAct.metadata?.statusRemarkResponseType
                  || lastAct.metadata?.callResult
                  || lastAct.metadata?.last_call_result;

                return (
                  <div className="qa-drawer-last-remark-card">
                    <div className="qa-drawer-last-remark-header">
                      <span className="qa-drawer-last-remark-status">{statusLabel || 'Last Update'}</span>
                      <span className="qa-drawer-last-remark-date">{formatDateTime(lastAct.at || lastAct.created_at)}</span>
                    </div>
                    <div className="qa-drawer-last-remark-content">
                      {remark}
                    </div>
                    {callStatus && (
                      <div className={`qa-drawer-last-remark-call ${String(callStatus).toLowerCase().includes('not') ? 'missed' : 'answered'}`}>
                        {String(callStatus).replace('-', ' ')}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Update Status (Status Grid) ── */}
              {!quickActionLead.isClosed && (
                <>
                  <div className="qa-drawer-section">Update status</div>
                  {quickActionLeadReadOnly && (
                    <p style={{ margin: '0 20px 8px', fontSize: 12, color: 'var(--text-muted)' }}>This lead is view-only for you after handoff to Sales Head.</p>
                  )}
                  <div className="qa-drawer-status-grid">
                    {roleActions.filter((a) => {
                      const isNegotiation = a.code.includes('NEGOTIATION');
                      const isHotNegotiation = a.code.includes('NEGOTIATION_HOT') || a.targetStatusCode === 'NEGOTIATION_HOT';
                      const allowNegotiationAction = workspaceRole === 'SH' ? true : (!isNegotiation || isHotNegotiation);
                      return a.tone !== 'danger' && allowNegotiationAction;
                    }).map((action) => {
                      let icon = <ClipboardDocumentListIcon style={{ width: 18, height: 18 }} />;
                      let selClass = 'sel-default';
                      if (action.code.includes('RNR')) { icon = <ArrowPathIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-rnr'; }
                      else if (action.code.includes('SV_DONE') || action.code.includes('SITE_VISIT')) { icon = <CheckCircleIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-sv-done'; }
                      else if (action.code.includes('SCHEDULE') || action.code.includes('REVISIT')) { icon = <CalendarDaysIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-sv-scheduled'; }
                      else if (action.code.includes('FOLLOW_UP')) { icon = <PhoneIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-follow-up'; }
                      else if (action.code.includes('NEGOTIATION')) { icon = <HandRaisedIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-negotiation'; }
                      else if (action.code.includes('BOOKING')) { icon = <SparklesIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-booking'; }
                      else if (action.code.includes('PAYMENT')) { icon = <BanknotesIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-booking'; }
                      else if (action.code.includes('REASSIGN')) { icon = <UserIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-follow-up'; }

                      return (
                        <button
                          key={action.code}
                          type="button"
                          className={`qa-drawer-st-btn ${quickWorkflowAction?.code === action.code ? selClass : ''}`}
                          disabled={quickActionLoading || quickActionLeadReadOnly}
                          onClick={() => handleQuickWorkflowActionSelect(action)}
                        >
                          <div className="qa-drawer-st-icon">{icon}</div>
                          <div className="qa-drawer-st-label">{action.label}</div>
                        </button>
                      );
                    })}
                    {/* Danger / Disqualification actions in the grid */}
                    {roleActions.filter(a => a.tone === 'danger').map((action) => (
                      <button
                        key={action.code}
                        type="button"
                        className={`qa-drawer-st-btn ${quickWorkflowAction?.code === action.code ? 'sel-junk' : ''}`}
                        disabled={quickActionLoading || quickActionLeadReadOnly}
                        onClick={() => handleQuickWorkflowActionSelect(action)}
                      >
                        <div className="qa-drawer-st-icon">{action.code.includes('JUNK') ? <NoSymbolIcon style={{ width: 18, height: 18 }} /> : action.code.includes('SPAM') ? <TrashIcon style={{ width: 18, height: 18 }} /> : <ExclamationTriangleIcon style={{ width: 18, height: 18 }} />}</div>
                        <div className="qa-drawer-st-label">{action.label}</div>
                      </button>
                    ))}
                  </div>

                </>
              )}

              {/* ── Dynamic Form: Shows only after selecting a status ── */}
              {quickWorkflowAction && (
                <div style={{ animation: 'qa-fade-in 0.3s ease' }}>
                  {/* ── Contextual: Follow-up Date (when action needs follow-up) ── */}
                  {quickWorkflowAction?.needsFollowUp && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Next follow-up date</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(0, 18, 0) }))}>Today </button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(1, 11, 0) }))}>Tmrw </button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(6, 11, 0) }))}>This Sat</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(0, 11, 0) }))}>This Sun</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(2, 11, 0) }))}>In 2 days</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(7, 11, 0) }))}>Next week</button>
                      </div>
                      <CalendarPicker
                        type="date"
                        value={quickWorkflowForm.nextFollowUpAt}
                        onChange={(val) => setQuickWorkflowForm((p) => ({ ...p, nextFollowUpAt: val }))}
                        placeholder="Select follow-up date..."
                        minDate={getFollowUpMinimumTime().toISOString()}
                        maxDate={followUpMaxDate(quickWorkflowAction?.targetStatusCode || selectedLead?.statusCode).toISOString()}
                      />
                    </div>
                  )}

                  {/* ── Contextual: Closure Reason (when action needs reason) ── */}
                  {quickWorkflowAction?.needsReason && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Reason *</div>
                      <select
                        className="qa-drawer-field-select"
                        value={quickWorkflowForm.closureReasonId}
                        onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, closureReasonId: e.target.value }))}
                        style={{ width: '100%', marginBottom: 8 }}
                      >
                        <option value="">Select a reason...</option>
                        {closureReasons.map(r => (
                          <option key={r.id} value={r.id}>{r.reason_name || r.reason_text || r.reason}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* ── Contextual: Assignee (when action needs assignee or SV details) ── */}
                  {(quickWorkflowAction?.needsAssignee || quickWorkflowAction?.needsSvDetails || quickWorkflowAction?.code === 'TC_SV_DONE') && (
                    <div className="qa-drawer-ctx-block">
                      <label className="qa-drawer-field-label">
                        {getAssigneeRoleForAction(quickWorkflowAction, workspaceRole) === 'SH' ? 'Select Sales Head (Negotiator) *' : 'Assign To *'}
                      </label>
                      <select
                        className="qa-drawer-field-select"
                        value={quickWorkflowForm.assignToUserId}
                        onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                        style={{ width: '100%' }}
                      >
                        <option value="">
                          {getAssigneeRoleForAction(quickWorkflowAction, workspaceRole) === 'SH' ? 'Select Sales Head...' :
                            getAssigneeRoleForAction(quickWorkflowAction, workspaceRole) === 'COL' ? 'Select Collection Manager...' : 'Select user...'}
                        </option>
                        {(assignableUsers[getAssigneeRoleForAction(quickWorkflowAction, workspaceRole)] || [])
                          .filter((u) => {
                            const currentAssigneeId = quickActionLead?.assignedToUserId || selectedLead?.assignedToUserId || null;
                            if (u.id === currentAssigneeId) return false;

                            if (quickWorkflowAction?.code === 'TC_REASSIGN') {
                              const leadLocationId = quickActionLead?.locationId || (quickActionLead?.interestedLocations?.[0]) || null;
                              if (!leadLocationId) return true; // fallback if lead has no location
                              return Array.isArray(u.locationIds) && u.locationIds.some(locId => String(locId) === String(leadLocationId));
                            }
                            return true;
                          })
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {quickWorkflowNeedsMissingLocationProject && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        Lead details
                        {quickLeadHasLocation && quickLeadHasProject ? <CheckIcon style={{ width: 13, height: 13 }} /> : null}
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        {/* Location Dropdown */}
                        {!quickLeadHasLocation && (
                          <div style={{ flex: 1, position: 'relative' }}>
                            <label className="qa-drawer-field-label">Location *</label>
                            <div
                              className="qa-drawer-field-select"
                              onClick={() => setQuickLocationDropdownOpen(p => !p)}
                              style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px' }}
                            >
                              {!quickWorkflowForm.locationId && <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13 }}>Select location...</span>}
                              {quickWorkflowForm.locationId && locationOptions.find(l => String(l.id) === String(quickWorkflowForm.locationId)) && (
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {locationOptions.find(l => String(l.id) === String(quickWorkflowForm.locationId))?.location_name}
                                  <span onClick={(e) => { e.stopPropagation(); setQuickWorkflowForm(prev => ({ ...prev, locationId: '', projectIds: [] })); setQuickMissingLocationId(''); setQuickMissingProjectIds([]); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                                </span>
                              )}
                            </div>
                            {quickLocationDropdownOpen && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 240, marginTop: 4 }}>
                                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                                  <input type="text" placeholder="Search locations..." value={quickLocationSearch} onChange={(e) => setQuickLocationSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #0f172a)' }} />
                                </div>
                                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                  {(quickLocationSearch.trim() ? locationOptions.filter(l => (l.location_name || '').toLowerCase().includes(quickLocationSearch.toLowerCase()) || (l.city || '').toLowerCase().includes(quickLocationSearch.toLowerCase())) : locationOptions).map((loc) => (
                                    <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-primary, #f1f5f9)', color: 'var(--text-primary, #0f172a)' }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <input type="radio" checked={String(quickWorkflowForm.locationId) === String(loc.id)} onChange={() => { setQuickWorkflowForm(prev => ({ ...prev, locationId: String(loc.id), projectIds: [] })); setQuickMissingLocationId(String(loc.id)); setQuickMissingProjectIds([]); setQuickLocationDropdownOpen(false); setQuickLocationSearch(''); }} />
                                      {loc.location_name}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Project Dropdown */}
                        {!quickLeadHasProject && (
                          <div style={{ flex: 1, position: 'relative' }}>
                            <label className="qa-drawer-field-label">Project * {quickWorkflowForm.projectIds?.length > 0 && `(${quickWorkflowForm.projectIds.length})`}</label>
                            <div
                              className="qa-drawer-field-select"
                              onClick={() => setQuickProjectDropdownOpen(p => !p)}
                              style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px' }}
                            >
                              {(quickWorkflowForm.projectIds || []).length === 0 && <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13 }}>Select projects...</span>}
                              {(quickWorkflowForm.projectIds || []).map((projId, i) => {
                                const projName = projectOptions.find(p => String(p.id) === String(projId))?.project_name;
                                return projName ? (
                                  <span key={i} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    {projName}
                                    <span onClick={(e) => { e.stopPropagation(); setQuickWorkflowForm(prev => ({ ...prev, projectIds: (prev.projectIds || []).filter((id) => String(id) !== String(projId)) })); setQuickMissingProjectIds(prev => (prev || []).filter((id) => String(id) !== String(projId))); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                                  </span>
                                ) : null;
                              })}
                            </div>
                            {quickProjectDropdownOpen && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 240, marginTop: 4 }}>
                                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                                  <input type="text" placeholder="Search projects..." value={quickProjectSearch} onChange={(e) => setQuickProjectSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #0f172a)' }} />
                                </div>
                                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                  {(quickProjectSearch.trim() ? quickMissingProjectOptions.filter(p => (p.project_name || '').toLowerCase().includes(quickProjectSearch.toLowerCase()) || (p.project_code || '').toLowerCase().includes(quickProjectSearch.toLowerCase())) : quickMissingProjectOptions).map((project) => (
                                    <label key={project.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-primary, #f1f5f9)', color: 'var(--text-primary, #0f172a)' }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <input type="checkbox" checked={(quickWorkflowForm.projectIds || []).map(String).includes(String(project.id))} onChange={() => { setQuickWorkflowForm(prev => { const pIds = (prev.projectIds || []).map(String); const newIds = pIds.includes(String(project.id)) ? pIds.filter(id => id !== String(project.id)) : [...pIds, String(project.id)]; return { ...prev, projectIds: newIds }; }); setQuickMissingProjectIds(prev => { const pIds = (prev || []).map(String); return pIds.includes(String(project.id)) ? pIds.filter(id => id !== String(project.id)) : [...pIds, String(project.id)]; }); }} />
                                      {project.project_name}{project.project_code ? ` (${project.project_code})` : ''}
                                    </label>
                                  ))}
                                  {quickMissingProjectOptions.length === 0 && <div style={{ padding: '12px', color: 'var(--text-secondary, #94a3b8)', fontSize: 13, textAlign: 'center' }}>No projects found</div>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {quickWorkflowAction?.code === 'TC_SV_DONE' && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Visit details</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Site Visit Date *</label>
                          <input
                            type="date"
                            className="qa-drawer-field-input"
                            value={quickWorkflowForm.svDate}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, svDate: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Project Visited *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.svProjectId}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, svProjectId: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {projectOptions.map((p) => (
                              <option key={p.id} value={p.id}>{p.project_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Contextual: Site Visit Details (full capture, matches Add Site Visit) ── */}
                  {(quickWorkflowAction?.needsSvDetails && quickWorkflowAction?.code !== 'TC_SV_DONE') && (
                    <div className="qa-drawer-ctx-block">
                      {/* 📅 Visit Details */}
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>📅 Visit Details</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Visit Date *</label>
                          <input
                            type="date"
                            className="qa-drawer-field-input"
                            value={quickWorkflowForm.svDate}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, svDate: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Project *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.svProjectId}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, svProjectId: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {projectOptions.map((p) => (
                              <option key={p.id} value={p.id}>{p.project_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Time Slot</label>
                          <input
                            type="text"
                            className="qa-drawer-field-input"
                            placeholder="e.g. 10 AM - 12 PM"
                            value={quickWorkflowForm.scheduled_time_slot}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, scheduled_time_slot: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Time Spent (mins) *</label>
                          <input
                            type="number"
                            min="0"
                            className="qa-drawer-field-input"
                            placeholder="e.g. 30"
                            value={quickWorkflowForm.timeSpent}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, timeSpent: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* 👤 Customer Profile */}
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>👤 Customer Profile</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Buyer Profile *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.customerTypeId}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, customerTypeId: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {customerTypeOptions.map((ct) => (
                              <option key={ct.id} value={ct.id}>{ct.type_name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Age Bracket *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.ageBracket}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, ageBracket: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {AGE_BRACKET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Decision Maker Present *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.decisionMaker}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, decisionMaker: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {DECISION_MAKER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Secondary Contact *</label>
                          <input
                            type="text"
                            className="qa-drawer-field-input"
                            placeholder="Secondary phone"
                            value={quickWorkflowForm.secondaryContact}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, secondaryContact: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* 🏠 Property Requirement */}
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>🏠 Property Requirement</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Customer Requirement *</label>
                          <input
                            type="text"
                            className="qa-drawer-field-input"
                            placeholder="e.g. 2BHK near school"
                            value={quickWorkflowForm.customerRequirement}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, customerRequirement: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Budget *</label>
                          <input
                            type="text"
                            className="qa-drawer-field-input"
                            placeholder="e.g. 60L"
                            value={quickWorkflowForm.budget}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, budget: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Timeline to Buy *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.timelineToBuy}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, timelineToBuy: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {TIMELINE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Preferred Facing *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.preferredFacing}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, preferredFacing: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {FACING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <label className="qa-drawer-field-label">Address *</label>
                        <textarea
                          className="qa-drawer-remark-ta"
                          rows={2}
                          placeholder="Customer address"
                          value={quickWorkflowForm.address}
                          onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, address: e.target.value }))}
                        />
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <label className="qa-drawer-field-label">Specific Concerns *</label>
                        <textarea
                          className="qa-drawer-remark-ta"
                          rows={2}
                          placeholder="Customer concerns"
                          value={quickWorkflowForm.specificConcerns}
                          onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, specificConcerns: e.target.value }))}
                        />
                      </div>

                      {/* 💰 Purchase Intent */}
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>💰 Purchase Intent</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Purpose Of Purchase *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.motivationType}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, motivationType: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {motivationOptions.map((m) => (
                              <option key={m.id} value={m.motivation_name}>{m.motivation_name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Payment Type *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.paymentType}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, paymentType: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {PAYMENT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ── Contextual: Customer Profile ── */}
                  {(quickWorkflowAction?.needsCustomerProfile || quickWorkflowAction?.code === 'SH_BOOKING') && (
                    <div className="qa-drawer-profile-block">
                      {/* ── Buyer Name ── */}
                      <div className="qa-drawer-profile-section"><UserIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Buyer Name</div>
                      <div style={{ marginBottom: 12 }}>
                        <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} placeholder="Enter buyer name (if different from lead)" value={customerProfileForm.buyer_name} onChange={(e) => setCustomerProfileForm(p => ({ ...p, buyer_name: e.target.value }))} />
                      </div>
                      {/* ── Relation Details ── */}
                      <div className="qa-drawer-profile-grid" style={{ marginBottom: 12 }}>
                        <div>
                          <label className="qa-drawer-field-label">Relation (S/O or W/O)</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.relation_type} onChange={(e) => setCustomerProfileForm(p => ({ ...p, relation_type: e.target.value }))}>
                            <option value="">Select relation...</option>
                            <option value="S/O">S/O (Son of)</option>
                            <option value="W/O">W/O (Wife of)</option>
                            <option value="D/O">D/O (Daughter of)</option>
                            <option value="C/O">C/O (Care of)</option>
                          </select>
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Relative Name</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} placeholder="Enter relative name" value={customerProfileForm.relation_name} onChange={(e) => setCustomerProfileForm(p => ({ ...p, relation_name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Booking Date *</label>
                          <input type="date" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.bookingDate || ''} onChange={(e) => setCustomerProfileForm(p => ({ ...p, bookingDate: e.target.value }))} required />
                        </div>
                      </div>
                      {/* ── Project Selection for Booking ── */}
                      <div className="qa-drawer-profile-section"><MapPinIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Select Project for Booking</div>
                      <div className="qa-drawer-profile-grid">
                        <div>
                          <label className="qa-drawer-field-label">Location</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.bookingLocationId} onChange={(e) => { setCustomerProfileForm(p => ({ ...p, bookingLocationId: e.target.value, bookingProjectId: '' })); setAvailableUnits([]); }}>
                            <option value="">— Select Location —</option>
                            {locationOptions.filter(l => l.is_active !== false).map(loc => (
                              <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Project</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.bookingProjectId} onChange={(e) => {
                            const pid = e.target.value;
                            setCustomerProfileForm(p => ({ ...p, bookingProjectId: pid, bookingPhaseId: '', inventoryUnitId: '' }));
                            if (pid) {
                              projectPhaseApi.dropdown(pid).then(resp => setAvailablePhases(resp.data?.data || resp.data || [])).catch(() => setAvailablePhases([]));
                              inventoryUnitApi.getDropdown({ project_id: pid }).then(resp => setAvailableUnits(resp.data || [])).catch(() => setAvailableUnits([]));
                            } else { setAvailablePhases([]); setAvailableUnits([]); }
                          }}>
                            <option value="">— Select Project —</option>
                            {projectOptions.filter(p => p.is_active !== false && (!customerProfileForm.bookingLocationId || p.location_id === customerProfileForm.bookingLocationId)).map(proj => (
                              <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* ── Phase selection ── */}
                      {customerProfileForm.bookingProjectId && availablePhases.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <label className="qa-drawer-field-label">Phase</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.bookingPhaseId} onChange={(e) => {
                            const phId = e.target.value;
                            setCustomerProfileForm(p => ({ ...p, bookingPhaseId: phId, inventoryUnitId: '' }));
                            inventoryUnitApi.getDropdown({ project_id: customerProfileForm.bookingProjectId, phase_id: phId || undefined })
                              .then(resp => setAvailableUnits(resp.data || []))
                              .catch(() => setAvailableUnits([]));
                          }}>
                            <option value="">— All phases —</option>
                            {availablePhases.map(ph => (
                              <option key={ph.id} value={ph.id}>{ph.phase_name}{ph.phase_code ? ` (${ph.phase_code})` : ''}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* ── Inventory Unit Selection ── */}
                      {availableUnits.length > 0 && (
                        <>
                          <div className="qa-drawer-profile-section"><HomeModernIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Select Unit / Plot</div>
                          <div>
                            <label className="qa-drawer-field-label">Available Unit</label>
                            <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.inventoryUnitId} onChange={(e) => setCustomerProfileForm(p => ({ ...p, inventoryUnitId: e.target.value }))}>
                              <option value="">— Select Unit / Plot —</option>
                              {availableUnits.filter(u => u.unit_status === 'Available' && (!customerProfileForm.bookingPhaseId || u.phase_id === customerProfileForm.bookingPhaseId)).map(unit => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.unit_number}{unit.configuration ? ` — ${unit.configuration}` : ''}{unit.unit_area ? ` — ${unit.unit_area} ${unit.area_unit || 'sq.ft.'}` : ''}{unit.total_price ? ` — ₹${Number(unit.total_price).toLocaleString('en-IN')}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          {customerProfileForm.inventoryUnitId && (() => {
                            const su = availableUnits.find(u => u.id === customerProfileForm.inventoryUnitId);
                            if (!su) return null;
                            return (
                              <div style={{ margin: '8px 0', padding: '10px 12px', background: 'var(--bg-tertiary, #f0fdf4)', border: '1px solid #86efac', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>{su.unit_number}</div>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  {su.configuration && <span>Config: {su.configuration}</span>}
                                  {su.unit_area && <span>Area: {su.unit_area} {su.area_unit || 'sq.ft.'}</span>}
                                  {su.total_price && <span>Price: ₹{Number(su.total_price).toLocaleString('en-IN')}</span>}
                                  {su.facing && <span>Facing: {su.facing}</span>}
                                  {su.tower_block && <span>Block: {su.tower_block}</span>}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* ── Payment Plan Selection ── */}
                      <div className="qa-drawer-profile-section"><BanknotesIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Payment Plan *</div>
                      <div>
                        <label className="qa-drawer-field-label">Select Payment Plan</label>
                        <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.paymentPlanId} onChange={(e) => setCustomerProfileForm(p => ({ ...p, paymentPlanId: e.target.value }))}>
                          <option value="">— Select Payment Plan —</option>
                          {paymentPlans.map(plan => (
                            <option key={plan.id} value={plan.id}>
                              {plan.plan_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="qa-drawer-profile-section"><UserIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Personal Details</div>
                      <div className="qa-drawer-profile-grid-3">
                        <div>
                          <label className="qa-drawer-field-label">Date of Birth *</label>
                          <input type="date" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.date_of_birth} onChange={(e) => setCustomerProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Marital Status</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.marital_status} onChange={(e) => setCustomerProfileForm(p => ({ ...p, marital_status: e.target.value }))}>
                            <option value="">Select...</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Divorced">Divorced</option>
                            <option value="Widowed">Widowed</option>
                          </select>
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Purchase Type</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.purchase_type} onChange={(e) => setCustomerProfileForm(p => ({ ...p, purchase_type: e.target.value }))}>
                            <option value="">Select...</option>
                            <option value="Investment">Investment</option>
                            <option value="Self Use">Self Use</option>
                            <option value="Rental">Rental</option>
                            <option value="Gift">Gift</option>
                          </select>
                        </div>
                      </div>
                      <div className="qa-drawer-profile-grid">
                        <div>
                          <label className="qa-drawer-field-label">Occupation *</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.occupation} onChange={(e) => setCustomerProfileForm(p => ({ ...p, occupation: e.target.value }))} placeholder="e.g. Business, Salaried" />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Current Post</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.current_post} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_post: e.target.value }))} placeholder="e.g. Manager" />
                        </div>
                      </div>

                      <div className="qa-drawer-profile-section"><IdentificationIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Identity Documents</div>
                      <div className="qa-drawer-profile-grid">
                        <div>
                          <label className="qa-drawer-field-label">PAN Number</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%', textTransform: 'uppercase' }} maxLength={10} value={customerProfileForm.pan_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, pan_number: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Aadhar Number *</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} maxLength={12} value={customerProfileForm.aadhar_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, aadhar_number: e.target.value.replace(/\D/g, '') }))} placeholder="1234 5678 9012" />
                        </div>
                      </div>

                      <div className="qa-drawer-profile-section"><MapPinIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Current Address *</div>
                      <div>
                        <label className="qa-drawer-field-label">Address</label>
                        <textarea className="qa-drawer-remark-ta" rows={2} value={customerProfileForm.current_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_address: e.target.value }))} placeholder="Street address..." />
                      </div>
                      <div>
                        <label className="qa-drawer-field-label">Area / Locality</label>
                        <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.current_area} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_area: e.target.value }))} placeholder="e.g. MG Road, Koramangala" />
                      </div>
                      <div className="qa-drawer-profile-grid-3">
                        <div>
                          <label className="qa-drawer-field-label">City</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.current_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_city: e.target.value }))} />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">State</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.current_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_state: e.target.value }))}>
                            <option value="">— Select State —</option>
                            {INDIAN_STATES_UTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Pincode</label>
                          <input type="text" className="qa-drawer-field-input" style={{ maxWidth: 120 }} maxLength={6} value={customerProfileForm.current_pincode} onChange={handlePincodeChange} placeholder="6 digits" />
                        </div>
                      </div>

                      {quickWorkflowAction?.code !== 'SH_BOOKING' && (
                        <>
                          <div className="qa-drawer-profile-section"><HomeModernIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Permanent Address</div>
                          <div>
                            <label className="qa-drawer-field-label">Address</label>
                            <textarea className="qa-drawer-remark-ta" rows={2} value={customerProfileForm.permanent_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_address: e.target.value }))} />
                          </div>
                          <div>
                            <label className="qa-drawer-field-label">Area / Locality</label>
                            <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.permanent_area} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_area: e.target.value }))} placeholder="e.g. MG Road, Koramangala" />
                          </div>
                          <div className="qa-drawer-profile-grid-3">
                            <div>
                              <label className="qa-drawer-field-label">City</label>
                              <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.permanent_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_city: e.target.value }))} />
                            </div>
                            <div>
                              <label className="qa-drawer-field-label">State</label>
                              <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.permanent_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_state: e.target.value }))}>
                                <option value="">— Select State —</option>
                                {INDIAN_STATES_UTS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="qa-drawer-field-label">Pincode</label>
                              <input type="text" className="qa-drawer-field-input" style={{ maxWidth: 120 }} maxLength={6} value={customerProfileForm.permanent_pincode} onChange={handlePermanentPincodeChange} placeholder="6 digits" />
                            </div>
                          </div>
                        </>
                      )}

                    </div>
                  )}

                  {/* ── Quick Remarks (secondary fields shown after action-required fields) ── */}
                  {quickStatusRemarks.length > 0 && (
                    <>
                      <div className="qa-drawer-section">Quick remarks — tap to fill</div>
                      <div className="qa-drawer-rchip-row">
                        {quickStatusRemarks.map(remark => (
                          <button
                            key={remark.id}
                            type="button"
                            className={`qa-drawer-rchip ${quickWorkflowForm.statusRemarkText === remark.remark_text ? 'sel' : ''}`}
                            onClick={() => {
                              setQuickWorkflowForm(p => ({ ...p, statusRemarkText: remark.remark_text, note: remark.remark_text }));
                              if (remark.has_ans_non_ans) {
                                setQuickRemarkAnsNonAns(remark.ans_non_ans_default || quickRemarkAnsNonAns || 'Answered');
                              } else {
                                setQuickRemarkAnsNonAns(null);
                              }
                            }}
                          >
                            {remark.remark_text}
                          </button>
                        ))}
                      </div>

                      {/* ── Ans/Non-Ans Toggle (if needed) ── */}
                      {quickWorkflowAction?.code !== 'SH_BOOKING' && quickStatusRemarks.some(r => r.has_ans_non_ans) && (
                        <div style={{ margin: '10px 0', padding: '10px', background: 'var(--bg-secondary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Call Status</span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              style={{
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 600,
                                border: quickRemarkAnsNonAns === 'Answered' ? '2px solid #0F7B5C' : '1px solid var(--border-primary)',
                                background: quickRemarkAnsNonAns === 'Answered' ? '#E0F4EE' : 'transparent',
                                color: quickRemarkAnsNonAns === 'Answered' ? '#0F7B5C' : 'var(--text-primary)',
                                borderRadius: 4,
                                cursor: quickStatusRemarks.some(r => r.ans_non_ans_disabled) ? 'not-allowed' : 'pointer',
                                opacity: quickStatusRemarks.some(r => r.ans_non_ans_disabled) ? 0.5 : 1,
                              }}
                              disabled={quickStatusRemarks.some(r => r.ans_non_ans_disabled)}
                              onClick={() => setQuickRemarkAnsNonAns('Answered')}
                            >
                              <CheckIcon style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 2 }} /> Answered
                            </button>
                            <button
                              type="button"
                              style={{
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 600,
                                border: quickRemarkAnsNonAns === 'Not-Answered' ? '2px solid #B45309' : '1px solid var(--border-primary)',
                                background: quickRemarkAnsNonAns === 'Not-Answered' ? '#FEF3C7' : 'transparent',
                                color: quickRemarkAnsNonAns === 'Not-Answered' ? '#B45309' : 'var(--text-primary)',
                                borderRadius: 4,
                                cursor: quickStatusRemarks.some(r => r.ans_non_ans_disabled) ? 'not-allowed' : 'pointer',
                                opacity: quickStatusRemarks.some(r => r.ans_non_ans_disabled) ? 0.5 : 1,
                              }}
                              disabled={quickStatusRemarks.some(r => r.ans_non_ans_disabled)}
                              onClick={() => setQuickRemarkAnsNonAns('Not-Answered')}
                            >
                              <XMarkIcon style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 2 }} /> Not Answered
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="qa-drawer-remark-wrap">
                    <textarea
                      className="qa-drawer-remark-ta"
                      rows={2}
                      value={quickWorkflowForm.note}
                      onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, note: e.target.value }))}
                      placeholder="What was discussed? What's the next step?"
                    />
                    {/* Voice note (record + transcribe + translate).
                        Roles are controlled in utils/voiceNotes.js. */}
                    {canUseVoiceNotes(workspaceRole) && (
                      <VoiceNoteField
                        voice={quickVoice}
                        onVoiceChange={setQuickVoice}
                        transcribeApi={leadWorkflowApi.transcribeVoice}
                        onTranscribed={(text) => setQuickWorkflowForm((p) => ({
                          ...p,
                          note: p.note?.trim() ? `${p.note.trim()}\n${text}` : text,
                        }))}
                      />
                    )}
                  </div>
                </div>
              )}


              <div className="qa-drawer-divider" />

              {/* ── Tabbed: Lead Activity / Remark History ── */}
              <div className="qa-drawer-tabs">
                <button
                  type="button"
                  className={`qa-drawer-tab ${qaActiveTab === 'history' ? 'qa-drawer-tab--active' : ''}`}
                  onClick={() => setQaActiveTab('history')}
                >
                  <TableCellsIcon style={{ width: 15, height: 15 }} /> Remark History
                </button>
                <button
                  type="button"
                  className={`qa-drawer-tab ${qaActiveTab === 'activity' ? 'qa-drawer-tab--active' : ''}`}
                  onClick={() => setQaActiveTab('activity')}
                >
                  <BoltIcon style={{ width: 15, height: 15 }} /> Lead Activity
                </button>
              </div>

              {/* ── Lead Activity Timeline (tab) ── */}
              {qaActiveTab === 'activity' && (
                <>
                  <div className="qa-drawer-history">
                    {quickActionActivities.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>No history yet.</p>
                    ) : (
                      quickActionActivities.slice(0, 5).map((act, i) => {
                        const isStage = act.type === 'STAGE_CHANGE';
                        const isNote = act.type === 'NOTE_ADDED';
                        const dotColor = isStage ? '#5B3FA6' : isNote ? '#B45309' : '#1A5FA8';
                        const dotBg = isStage ? '#EEE9FC' : isNote ? '#FEF3C7' : '#E3EEFB';
                        return (
                          <div key={act.id} className="qa-drawer-hist-item">
                            <div className="qa-drawer-hist-col">
                              <div className="qa-drawer-hist-dot" style={{ background: dotBg, borderColor: dotColor }} />
                              {i < Math.min(quickActionActivities.length, 5) - 1 && <div className="qa-drawer-hist-line" />}
                            </div>
                            <div className="qa-drawer-hist-right">
                              <div className="qa-drawer-hist-header">
                                <span className="qa-drawer-hist-status" style={{ color: dotColor }}>{act.title}</span>
                                <span className="qa-drawer-hist-date">{formatDateTimeInTimeZone(act.at || act.created_at)}</span>
                              </div>
                              {act.description && <div className="qa-drawer-hist-remark">{formatActivityDescription(act.description, act)}</div>}
                              {act.metadata?.voice?.file_url && (
                                <AuthedAudio
                                  src={act.metadata.voice.file_url}
                                  controls
                                  preload="none"
                                  style={{ height: 34, width: '100%', maxWidth: 260, marginTop: 6 }}
                                />
                              )}
                              {(act.metadata?.statusRemarkResponseType || act.metadata?.callResult || act.metadata?.last_call_result) && (
                                <div className="qa-drawer-hist-remark" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  Call Status: {(act.metadata?.statusRemarkResponseType || act.metadata?.callResult || act.metadata?.last_call_result || '').replace('-', ' ')}
                                </div>
                              )}
                              <div className="qa-drawer-hist-by">By {act.by || 'System'}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* ── Site Visit History ── */}
                  {quickActionSiteVisits.length > 0 && (
                    <>
                      <div className="qa-drawer-divider" />
                      <div className="qa-drawer-section" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><HomeModernIcon style={{ width: 16, height: 16 }} /> Recent site visits</div>
                      <div style={{ padding: '0 20px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {quickActionSiteVisits.slice(0, 4).map((sv) => (
                          <div key={sv.id} style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <strong style={{ fontSize: 12 }}>{sv.project?.project_name || 'Unknown'}</strong>
                              <span style={{ fontSize: 10, color: sv.status === 'Completed' ? '#0F7B5C' : '#B45309', fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: sv.status === 'Completed' ? '#E0F4EE' : '#FEF3C7' }}>{sv.status}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {sv.actual_visit_date
                                ? <><CheckCircleIcon style={{ width: 12, height: 12 }} /> {formatDateTime(sv.actual_visit_date)}</>
                                : <><CalendarDaysIcon style={{ width: 12, height: 12 }} /> {formatDateTime(sv.scheduled_date)}</>}
                            </div>
                            {sv.attendedBy && (
                              <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 3 }}>
                                By {sv.attendedBy.first_name} {sv.attendedBy.last_name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {quickActionSiteVisits.length > 4 && (
                        <div style={{ textAlign: 'center', paddingBottom: 10, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                          +{quickActionSiteVisits.length - 4} more
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ══ Remark History Tab ══ */}
              {qaActiveTab === 'history' && (
                <div className="qa-remark-history">
                  {(() => {
                    const remarkActivities = quickActionActivities.filter((act) => {
                      const remarkText = getUserRemarkText(act);
                      const statusLabel = getRemarkHistoryStatusLabel(act, workflowConfig);
                      const callStatus = act.metadata?.statusRemarkResponseType
                        || act.metadata?.callResult
                        || act.metadata?.last_call_result
                        || '';
                      const closureReason = act.metadata?.closureReasonName || act.metadata?.closure_reason || '';
                      const hasMeaningfulRemark = Boolean(remarkText || closureReason);
                      const hasWorkflowContext = Boolean(statusLabel || callStatus || closureReason);
                      return hasMeaningfulRemark && hasWorkflowContext;
                    });
                    // Same-day updates collapse into a single entry: activities are newest-first,
                    // so keeping the first per local day shows that day's latest (the "rewrite").
                    // Lead Activity tab still shows every entry, preserving the full audit trail.
                    const seenDays = new Set();
                    const dailyRemarkActivities = remarkActivities.filter((act) => {
                      const d = new Date(act.at || act.created_at);
                      if (Number.isNaN(d.getTime())) return true;
                      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                      if (seenDays.has(dayKey)) return false;
                      seenDays.add(dayKey);
                      return true;
                    });
                    if (dailyRemarkActivities.length === 0) {
                      return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>No remarks recorded yet.</p>;
                    }
                    return (
                      <div className="qa-remark-table-wrap">
                        <table className="qa-remark-table">
                          <thead>
                            <tr>
                              <th>Status</th>
                              <th>Remarks</th>
                              <th>Call / Response</th>
                              <th>By</th>
                              <th>Date & Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyRemarkActivities.map((act) => {
                              const remarkText = getUserRemarkText(act);
                              const statusLabel = getRemarkHistoryStatusLabel(act, workflowConfig);
                              const callStatus = act.metadata?.statusRemarkResponseType
                                || act.metadata?.callResult
                                || act.metadata?.last_call_result
                                || '';
                              const byName = act.by || 'System';
                              const byRole = act.metadata?.performedByRole || act.metadata?.role || '';
                              const closureReason = act.metadata?.closureReasonName || act.metadata?.closure_reason || '';
                              return (
                                <tr key={act.id}>
                                  <td data-label="Status">
                                    <span className="qa-remark-status-badge">{statusLabel || '—'}</span>
                                  </td>
                                  <td data-label="Remarks">
                                    <div>{remarkText || '—'}</div>
                                    {closureReason && (
                                      <div className="qa-remark-closure">Reason: {closureReason}</div>
                                    )}
                                  </td>
                                  <td data-label="Call / Response">
                                    {callStatus ? (
                                      <span className={`qa-remark-call-badge ${callStatus.toLowerCase().includes('not') ? 'qa-remark-call-badge--missed' : 'qa-remark-call-badge--answered'}`}>
                                        {callStatus.replace('-', ' ')}
                                      </span>
                                    ) : '—'}
                                  </td>
                                  <td data-label="By">
                                    <div className="qa-remark-by-name">{byName}</div>
                                    {byRole && <div className="qa-remark-by-role">{byRole}</div>}
                                  </td>
                                  <td data-label="Date & Time" className="qa-remark-date">{formatDateTime(act.at || act.created_at)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── Save Row (sticky bottom) ── */}
            <div className="qa-drawer-save-row">
              <button
                className="qa-drawer-skip-btn"
                onClick={() => {
                  setQuickActionLead(null);
                  resetQuickWorkflowForm();
                }}
              >
                Close
              </button>
              <button
                className="qa-drawer-save-btn"
                disabled={
                  quickActionLoading
                  || quickActionLeadReadOnly
                  || !quickWorkflowAction
                  || (isRemarkMandatoryForAction(quickWorkflowAction)
                    && !(quickWorkflowForm.statusRemarkText || '').trim()
                    && !(quickWorkflowForm.note || '').trim())
                  || ((quickWorkflowAction?.needsAssignee
                    || quickWorkflowAction?.code === 'TC_SV_DONE'
                    || quickWorkflowAction?.code === 'TC_REASSIGN')
                    && !quickWorkflowForm.assignToUserId)
                  || (quickWorkflowAction?.needsFollowUp && !quickWorkflowForm.nextFollowUpAt)
                  || (Boolean(quickWorkflowForm.nextFollowUpAt) && !isFollowUpAtLeastMinutesAhead(quickWorkflowForm.nextFollowUpAt))
                  || (quickWorkflowAction?.needsReason && !quickWorkflowForm.closureReasonId)
                  || ((quickWorkflowAction?.needsCustomerProfile || quickWorkflowAction?.code === 'SH_BOOKING') && !customerProfileForm.inventoryUnitId)
                }
                onClick={handleQuickWorkflowSubmit} style={{ backgroundColor: '#625afa' }}
              >
                {quickActionLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LeadWorkspacePage;

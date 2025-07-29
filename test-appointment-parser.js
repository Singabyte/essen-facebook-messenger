#!/usr/bin/env node

// Test appointment parsing logic
const { parseAppointmentDetails, isValidAppointmentTime } = require('./src/messageHandler');

console.log('🧪 Testing Appointment Parser\n');

const testCases = [
  // Should work
  'thursday 12pm',
  'Thursday 12pm',
  'tomorrow at 2pm',
  '1st August, 12pm',
  '1st August at 12pm',
  '25 Dec at 3:30pm',
  'today at 11am',
  'monday 3pm',
  'next friday at 2:30pm',
  '12/08 at 1pm',
  '12-08-2024 at 2pm',
  'noon tomorrow',
  // Should fail time validation
  'tomorrow at 8pm',
  'today at 10am',
  // Should fail parsing
  'sometime next week',
  'maybe thursday',
  'around 2ish'
];

console.log('Testing date/time parsing:\n');

testCases.forEach(testCase => {
  const details = parseAppointmentDetails(testCase);
  console.log(`Input: "${testCase}"`);
  console.log(`Parsed:`, details);
  
  if (details.time) {
    const validTime = isValidAppointmentTime(details.time);
    console.log(`Valid time (11am-7pm):`, validTime);
  }
  console.log('---');
});

console.log('\n✅ Test completed!');
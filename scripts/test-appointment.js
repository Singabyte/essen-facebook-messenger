const { parseAppointmentDetails, isValidAppointmentTime } = require('../src/messageHandler');

// Test appointment parsing
console.log('Testing appointment parsing...\n');

const testCases = [
  'tomorrow at 2pm',
  'today 3:30pm',
  '25 Dec at 11am',
  'December 31 at 6:45pm',
  'tomorrow 10am', // Too early
  'today at 8pm', // Too late
  'tomorrow at 2pm, my number is 9123 4567',
  'Dec 25 at 3pm +65 8234 5678',
];

testCases.forEach(test => {
  console.log(`Input: "${test}"`);
  const details = parseAppointmentDetails(test);
  console.log('Parsed:', details);
  
  if (details.time) {
    const isValid = isValidAppointmentTime(details.time);
    console.log(`Time valid (11am-7pm): ${isValid}`);
  }
  console.log('---');
});

// Test time validation
console.log('\nTesting time validation...\n');

const timesToTest = [
  '10:30am', // Too early
  '11am',    // Valid - opening time
  '11:15am', // Valid
  '12pm',    // Valid
  '2:30pm',  // Valid
  '6:45pm',  // Valid
  '7pm',     // Invalid - closing time
  '8pm',     // Too late
];

timesToTest.forEach(time => {
  const isValid = isValidAppointmentTime(time);
  console.log(`${time}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
});

console.log('\nTest complete!');
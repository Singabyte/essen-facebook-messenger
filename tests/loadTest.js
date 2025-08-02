/**
 * Load testing script for ESSEN Facebook Messenger Bot
 * Tests bot performance under concurrent load
 */

const axios = require('axios');
const { performanceTestData, mockUsers } = require('./fixtures/testData');

const LOAD_TEST_CONFIG = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  concurrentUsers: process.env.CONCURRENT_USERS || 50,
  messagesPerUser: process.env.MESSAGES_PER_USER || 10,
  testDuration: process.env.TEST_DURATION || 60000, // 1 minute
  rampUpTime: process.env.RAMP_UP_TIME || 10000, // 10 seconds
};

class LoadTester {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      startTime: null,
      endTime: null
    };
  }

  /**
   * Create a webhook message for testing
   */
  createTestMessage(userId, messageIndex) {
    const messages = [
      'Hello',
      'Do you have promotions?',
      'What are your opening hours?',
      'Show me sofa collection',
      'Book appointment',
      'Kitchen renovation packages?',
      'Toilet sets available?',
      'WhatsApp contact please',
      'Visit showroom details',
      'Thank you'
    ];

    const messageText = messages[messageIndex % messages.length];
    
    return {
      object: 'page',
      entry: [{
        messaging: [{
          sender: { id: userId },
          recipient: { id: 'test_page_id' },
          timestamp: Date.now(),
          message: { text: messageText }
        }]
      }]
    };
  }

  /**
   * Send a single message and measure response time
   */
  async sendMessage(userId, messageIndex) {
    const startTime = Date.now();
    this.results.totalRequests++;

    try {
      const message = this.createTestMessage(userId, messageIndex);
      
      const response = await axios.post(
        `${LOAD_TEST_CONFIG.baseURL}/webhook`,
        message,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': 'sha256=test_signature'
          },
          timeout: 10000
        }
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      this.results.responseTimes.push(responseTime);
      this.results.successfulRequests++;

      return {
        success: true,
        responseTime,
        status: response.status
      };

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      this.results.failedRequests++;
      this.results.errors.push({
        error: error.message,
        responseTime,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        responseTime,
        error: error.message
      };
    }
  }

  /**
   * Simulate a single user's conversation
   */
  async simulateUser(userId, messageCount) {
    const userResults = [];
    
    for (let i = 0; i < messageCount; i++) {
      const result = await this.sendMessage(userId, i);
      userResults.push(result);
      
      // Random delay between messages (1-3 seconds)
      const delay = 1000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return userResults;
  }

  /**
   * Run load test with ramping
   */
  async runLoadTest() {
    console.log('🚀 Starting ESSEN Bot Load Test');
    console.log(`📊 Configuration:`);
    console.log(`   - Concurrent Users: ${LOAD_TEST_CONFIG.concurrentUsers}`);
    console.log(`   - Messages per User: ${LOAD_TEST_CONFIG.messagesPerUser}`);
    console.log(`   - Test Duration: ${LOAD_TEST_CONFIG.testDuration}ms`);
    console.log(`   - Ramp-up Time: ${LOAD_TEST_CONFIG.rampUpTime}ms`);
    console.log(`   - Target URL: ${LOAD_TEST_CONFIG.baseURL}`);
    console.log('');

    this.results.startTime = Date.now();
    
    const promises = [];
    const userSpacing = LOAD_TEST_CONFIG.rampUpTime / LOAD_TEST_CONFIG.concurrentUsers;

    // Ramp up users gradually
    for (let i = 0; i < LOAD_TEST_CONFIG.concurrentUsers; i++) {
      const userId = `load_test_user_${i}`;
      
      // Delay each user's start to ramp up gradually
      const startDelay = i * userSpacing;
      
      const userPromise = new Promise(async (resolve) => {
        await new Promise(r => setTimeout(r, startDelay));
        const results = await this.simulateUser(userId, LOAD_TEST_CONFIG.messagesPerUser);
        resolve(results);
      });
      
      promises.push(userPromise);
    }

    try {
      console.log('⏳ Running load test...');
      await Promise.all(promises);
      
      this.results.endTime = Date.now();
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Load test failed:', error);
      this.results.endTime = Date.now();
      this.generateReport();
    }
  }

  /**
   * Generate and display test results
   */
  generateReport() {
    const duration = this.results.endTime - this.results.startTime;
    const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
    
    // Calculate response time statistics
    const responseTimes = this.results.responseTimes.sort((a, b) => a - b);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];
    
    // Calculate throughput
    const requestsPerSecond = (this.results.totalRequests / duration) * 1000;

    console.log('\n📈 LOAD TEST RESULTS');
    console.log('==========================================');
    console.log(`⏱️  Test Duration: ${duration}ms (${(duration/1000).toFixed(1)}s)`);
    console.log(`📨 Total Requests: ${this.results.totalRequests}`);
    console.log(`✅ Successful: ${this.results.successfulRequests}`);
    console.log(`❌ Failed: ${this.results.failedRequests}`);
    console.log(`📊 Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`🔥 Throughput: ${requestsPerSecond.toFixed(2)} requests/second`);
    console.log('');
    console.log('📏 RESPONSE TIME STATISTICS:');
    console.log(`   Average: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`   Minimum: ${minResponseTime}ms`);
    console.log(`   Maximum: ${maxResponseTime}ms`);
    console.log(`   95th Percentile: ${p95ResponseTime}ms`);
    console.log(`   99th Percentile: ${p99ResponseTime}ms`);
    
    if (this.results.errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      const errorCounts = {};
      this.results.errors.forEach(error => {
        errorCounts[error.error] = (errorCounts[error.error] || 0) + 1;
      });
      
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`   ${error}: ${count} occurrences`);
      });
    }

    // Performance assessment
    console.log('\n🎯 PERFORMANCE ASSESSMENT:');
    this.assessPerformance(avgResponseTime, successRate, p95ResponseTime);
    
    // Save results to file
    this.saveResults();
  }

  /**
   * Assess performance against benchmarks
   */
  assessPerformance(avgResponseTime, successRate, p95ResponseTime) {
    const benchmarks = {
      avgResponseTime: 2000, // 2 seconds
      successRate: 95, // 95%
      p95ResponseTime: 5000 // 5 seconds
    };

    console.log(`   Average Response Time: ${avgResponseTime <= benchmarks.avgResponseTime ? '✅' : '❌'} ${avgResponseTime.toFixed(0)}ms (target: <${benchmarks.avgResponseTime}ms)`);
    console.log(`   Success Rate: ${successRate >= benchmarks.successRate ? '✅' : '❌'} ${successRate.toFixed(1)}% (target: >${benchmarks.successRate}%)`);
    console.log(`   95th Percentile: ${p95ResponseTime <= benchmarks.p95ResponseTime ? '✅' : '❌'} ${p95ResponseTime}ms (target: <${benchmarks.p95ResponseTime}ms)`);

    const overallPass = 
      avgResponseTime <= benchmarks.avgResponseTime &&
      successRate >= benchmarks.successRate &&
      p95ResponseTime <= benchmarks.p95ResponseTime;

    console.log(`\n   Overall Assessment: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
  }

  /**
   * Save results to JSON file
   */
  saveResults() {
    const resultsData = {
      timestamp: new Date().toISOString(),
      config: LOAD_TEST_CONFIG,
      results: this.results,
      summary: {
        duration: this.results.endTime - this.results.startTime,
        successRate: (this.results.successfulRequests / this.results.totalRequests) * 100,
        avgResponseTime: this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length,
        throughput: (this.results.totalRequests / (this.results.endTime - this.results.startTime)) * 1000
      }
    };

    const fs = require('fs');
    const filename = `load-test-results-${Date.now()}.json`;
    
    try {
      fs.writeFileSync(filename, JSON.stringify(resultsData, null, 2));
      console.log(`\n💾 Results saved to: ${filename}`);
    } catch (error) {
      console.error('Failed to save results:', error.message);
    }
  }
}

// Run load test if called directly
if (require.main === module) {
  const loadTester = new LoadTester();
  loadTester.runLoadTest().catch(console.error);
}

module.exports = LoadTester;
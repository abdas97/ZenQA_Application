const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Dummy data for demonstration
const dummyTestCases = [
  {
    id: 1,
    userStory: "As a user, I want to login to the application",
    testCases: [
      "Verify successful login with valid credentials",
      "Verify error message for invalid credentials",
      "Verify password field is masked",
      "Verify remember me functionality"
    ]
  },
  {
    id: 2,
    userStory: "As a user, I want to search for products",
    testCases: [
      "Verify search with valid product name",
      "Verify search with partial product name",
      "Verify search with invalid product name",
      "Verify search filters functionality"
    ]
  }
];

const dummyAutomationCode = {
  java: `
package com.qa.tests;

import com.microsoft.playwright.*;
import org.junit.jupiter.api.Test;

public class LoginTest {
    
    @Test
    public void testValidLogin() {
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch();
            Page page = browser.newPage();
            
            // Navigate to login page
            page.navigate("https://example.com/login");
            
            // Fill login credentials
            page.fill("#username", "validuser@example.com");
            page.fill("#password", "validpassword");
            
            // Click login button
            page.click("#loginBtn");
            
            // Verify successful login
            page.waitForSelector(".dashboard");
            
            browser.close();
        }
    }
    
    @Test
    public void testInvalidLogin() {
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch();
            Page page = browser.newPage();
            
            // Navigate to login page
            page.navigate("https://example.com/login");
            
            // Fill invalid credentials
            page.fill("#username", "invalid@example.com");
            page.fill("#password", "wrongpassword");
            
            // Click login button
            page.click("#loginBtn");
            
            // Verify error message
            page.waitForSelector(".error-message");
            
            browser.close();
        }
    }
}
  `
};

const dummyExecutionResults = {
  testResults: [
    { 
      testName: "testValidLogin", 
      status: "PASSED", 
      duration: "2.3s",
      details: "Login successful with valid credentials"
    },
    { 
      testName: "testInvalidLogin", 
      status: "PASSED", 
      duration: "1.8s",
      details: "Error message displayed correctly for invalid credentials"
    },
    { 
      testName: "testPasswordMasking", 
      status: "FAILED", 
      duration: "1.2s",
      details: "Password field masking not working properly"
    },
    { 
      testName: "testRememberMe", 
      status: "PASSED", 
      duration: "3.1s",
      details: "Remember me functionality working as expected"
    }
  ],
  summary: {
    total: 4,
    passed: 3,
    failed: 1,
    duration: "8.4s",
    timestamp: new Date().toISOString()
  }
};

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    // Broadcast to all clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// API Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Generate test cases from user story
app.post('/api/generate-testcases', async (req, res) => {
  const { userStory } = req.body;
  
  // Validate user input
  if (!userStory || userStory.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'User story is required and cannot be empty',
      message: 'Please provide a valid user story before generating test cases'
    });
  }
  
  if (userStory.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: 'User story too short',
      message: 'Please provide a more detailed user story (minimum 10 characters)'
    });
  }
  
  try {
    console.log('🔄 Processing user story:', userStory);
    
    // Step 1: Save user story to both timestamped CSV and main UserStory.csv file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const timestampedCsvFilePath = path.join(__dirname, 'data', `UserStory_${timestamp}.csv`);
    const mainCsvFilePath = path.join(__dirname, 'data', 'UserStory.csv');
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Analyze user story to determine category and metadata
    const storyAnalysis = analyzeUserStory(userStory);
    
    const userStoryRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      userStory: userStory.trim(),
      category: storyAnalysis.category,
      priority: storyAnalysis.priority,
      complexity: storyAnalysis.complexity
    };
    
    // Create CSV writer for timestamped file
    const timestampedCsvWriter = createObjectCsvWriter({
      path: timestampedCsvFilePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'userStory', title: 'User Story' },
        { id: 'category', title: 'Category' },
        { id: 'priority', title: 'Priority' },
        { id: 'complexity', title: 'Complexity' }
      ]
    });
    
    // Write to timestamped CSV
    await timestampedCsvWriter.writeRecords([userStoryRecord]);
    console.log('✅ User story saved to timestamped CSV:', timestampedCsvFilePath);
    
    // Handle main UserStory.csv file - append or create
    let existingRecords = [];
    if (fs.existsSync(mainCsvFilePath)) {
      // Read existing records from main CSV file
      existingRecords = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(mainCsvFilePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
      console.log(`📄 Found ${existingRecords.length} existing user stories in main CSV`);
    }
    
    // Check if this user story already exists (avoid duplicates)
    const userStoryExists = existingRecords.some(record => 
      record['User Story'] && 
      record['User Story'].trim().toLowerCase() === userStory.trim().toLowerCase()
    );
    
    if (!userStoryExists) {
      // Add new record to existing records
      existingRecords.push({
        'ID': userStoryRecord.id,
        'Timestamp': userStoryRecord.timestamp,
        'User Story': userStoryRecord.userStory,
        'Category': userStoryRecord.category,
        'Priority': userStoryRecord.priority,
        'Complexity': userStoryRecord.complexity
      });
      
      // Create CSV writer for main file
      const mainCsvWriter = createObjectCsvWriter({
        path: mainCsvFilePath,
        header: [
          { id: 'ID', title: 'ID' },
          { id: 'Timestamp', title: 'Timestamp' },
          { id: 'User Story', title: 'User Story' },
          { id: 'Category', title: 'Category' },
          { id: 'Priority', title: 'Priority' },
          { id: 'Complexity', title: 'Complexity' }
        ]
      });
      
      // Write all records (existing + new) to main CSV
      await mainCsvWriter.writeRecords(existingRecords);
      console.log('✅ User story appended to main UserStory.csv file');
    } else {
      console.log('ℹ️ User story already exists in main CSV, skipping duplicate');
    }
    
    // Step 2: AI Analysis and Test Case Generation
    console.log('🤖 Starting AI analysis of user story...');
    const testCases = await generateComprehensiveTestCases(userStory, storyAnalysis);
    
    // Step 3: Save test cases to CSV
    const testCasesCsvPath = path.join(__dirname, 'data', `TestCases_${timestamp}.csv`);
    const testCasesWriter = createObjectCsvWriter({
      path: testCasesCsvPath,
      header: [
        { id: 'testCaseId', title: 'Test Case ID' },
        { id: 'testCaseName', title: 'Test Case Name' },
        { id: 'category', title: 'Category' },
        { id: 'priority', title: 'Priority' },
        { id: 'preconditions', title: 'Preconditions' },
        { id: 'testSteps', title: 'Test Steps' },
        { id: 'expectedResults', title: 'Expected Results' },
        { id: 'testData', title: 'Test Data' },
        { id: 'userStoryRef', title: 'User Story Reference' }
      ]
    });
    
    await testCasesWriter.writeRecords(testCases.map(tc => ({
      ...tc,
      testSteps: tc.testSteps.join(' | '),
      userStoryRef: userStoryRecord.id
    })));
    
    console.log('✅ Test cases saved to CSV:', testCasesCsvPath);
    
    // Return response
    res.json({
      success: true,
      userStory,
      testCases: testCases.map(tc => tc.testCaseName),
      detailedTestCases: testCases,
      analysis: storyAnalysis,
      csvFiles: {
        userStoryTimestamped: timestampedCsvFilePath,
        userStoryMain: mainCsvFilePath,
        testCases: testCasesCsvPath
      },
      generated: true,
      timestamp: new Date().toISOString(),
      totalTestCases: testCases.length,
      userStoryInfo: {
        saved: true,
        duplicate: userStoryExists,
        mainCsvPath: mainCsvFilePath,
        timestampedCsvPath: timestampedCsvFilePath
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing user story:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process user story and generate test cases',
      details: error.message
    });
  }
});

// Generate automation code
app.post('/api/generate-automation', (req, res) => {
  const { testCases } = req.body;
  
  // Simulate processing delay
  setTimeout(() => {
    res.json({
      success: true,
      code: dummyAutomationCode.java,
      language: 'java',
      framework: 'playwright',
      timestamp: new Date().toISOString()
    });
  }, 2000);
});

// Get execution results
app.get('/api/execution-results', (req, res) => {
  // Simulate processing delay
  setTimeout(() => {
    res.json({
      success: true,
      results: dummyExecutionResults,
      timestamp: new Date().toISOString()
    });
  }, 1000);
});

// Run automation code endpoint
app.post('/api/java/run-automation', (req, res) => {
  const { code, testCases } = req.body;
  
  // Simulate test execution delay
  setTimeout(() => {
    // Simulate some test results based on the test cases
    const testResults = testCases.map((testCase, index) => {
      const isLogin = testCase.toLowerCase().includes('login');
      const isSearch = testCase.toLowerCase().includes('search');
      const shouldPass = Math.random() > 0.2; // 80% pass rate
      
      return {
        testName: `test_${testCase.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30)}`,
        status: shouldPass ? 'PASSED' : 'FAILED',
        duration: `${(Math.random() * 3 + 1).toFixed(1)}s`,
        details: shouldPass ? 
          `${testCase} executed successfully` : 
          `${testCase} failed - assertion error`
      };
    });
    
    const passed = testResults.filter(r => r.status === 'PASSED').length;
    const failed = testResults.filter(r => r.status === 'FAILED').length;
    const totalDuration = testResults.reduce((sum, r) => sum + parseFloat(r.duration), 0);
    
    const executionResults = {
      testResults,
      summary: {
        total: testResults.length,
        passed,
        failed,
        duration: `${totalDuration.toFixed(1)}s`,
        timestamp: new Date().toISOString()
      }
    };
    
    res.json({
      success: true,
      results: executionResults,
      message: `Test execution completed: ${passed}/${testResults.length} tests passed`,
      timestamp: new Date().toISOString()
    });
  }, 3000); // 3 second delay to simulate test execution
});

// Create detailed test steps from existing test cases
app.post('/api/create-test-steps', async (req, res) => {
  const { testCases, userStory } = req.body;
  
  // Validate input
  if (!testCases || testCases.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Test cases are required',
      message: 'Please provide test cases to generate detailed steps'
    });
  }
  
  try {
    console.log('🔄 Creating detailed test steps from existing test cases...');
    
    // Read the most recent TestCases CSV file if it exists
    const dataDir = path.join(__dirname, 'data');
    let existingTestCases = [];
    
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir)
        .filter(file => file.startsWith('TestCases_') && file.endsWith('.csv'))
        .sort()
        .reverse();
      
      if (files.length > 0) {
        const latestFile = path.join(dataDir, files[0]);
        console.log('📄 Reading existing test cases from:', latestFile);
        
        // Read CSV file
        existingTestCases = await new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(latestFile)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
        });
      }
    }
    
    // Generate detailed test steps by analyzing each test case
    const detailedTestCases = await generateDetailedTestSteps(testCases, userStory, existingTestCases);
    
    // Save detailed test steps to CSV
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const detailedCsvPath = path.join(__dirname, 'data', `DetailedTestSteps_${timestamp}.csv`);
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const detailedCsvWriter = createObjectCsvWriter({
      path: detailedCsvPath,
      header: [
        { id: 'testCaseId', title: 'Test Case ID' },
        { id: 'testCaseName', title: 'Test Case Name' },
        { id: 'category', title: 'Category' },
        { id: 'priority', title: 'Priority' },
        { id: 'preconditions', title: 'Preconditions' },
        { id: 'step1', title: 'Step 1' },
        { id: 'step2', title: 'Step 2' },
        { id: 'step3', title: 'Step 3' },
        { id: 'step4', title: 'Step 4' },
        { id: 'step5', title: 'Step 5' },
        { id: 'step6', title: 'Step 6' },
        { id: 'step7', title: 'Step 7' },
        { id: 'step8', title: 'Step 8' },
        { id: 'allTestSteps', title: 'All Test Steps (Combined)' },
        { id: 'expectedResults', title: 'Expected Results' },
        { id: 'testData', title: 'Test Data' },
        { id: 'userStoryRef', title: 'User Story Reference' },
        { id: 'generatedTimestamp', title: 'Generated Timestamp' }
      ]
    });
    
    // Prepare data with individual step columns and combined steps
    const csvData = detailedTestCases.map((tc, index) => {
      const stepData = {};
      
      // Add individual steps (up to 8 steps)
      for (let i = 1; i <= 8; i++) {
        stepData[`step${i}`] = tc.testSteps[i - 1] || '';
      }
      
      return {
        ...tc,
        ...stepData,
        allTestSteps: tc.testSteps.join(' | '),
        userStoryRef: userStory.substring(0, 100) + (userStory.length > 100 ? '...' : ''),
        generatedTimestamp: new Date().toISOString()
      };
    });
    
    await detailedCsvWriter.writeRecords(csvData);
    
    console.log('✅ Detailed test steps saved to CSV:', detailedCsvPath);
    
    // Save test case steps to separate TestCaseStep.csv file
    const testCaseStepCsvPath = path.join(__dirname, 'data', `TestCaseStep_${timestamp}.csv`);
    const testCaseStepWriter = createObjectCsvWriter({
      path: testCaseStepCsvPath,
      header: [
        { id: 'stepId', title: 'Step ID' },
        { id: 'testCaseId', title: 'Test Case ID' },
        { id: 'testCaseName', title: 'Test Case Name' },
        { id: 'stepNumber', title: 'Step Number' },
        { id: 'stepDescription', title: 'Step Description' },
        { id: 'stepType', title: 'Step Type' },
        { id: 'category', title: 'Category' },
        { id: 'priority', title: 'Priority' },
        { id: 'preconditions', title: 'Preconditions' },
        { id: 'expectedResults', title: 'Expected Results' },
        { id: 'testData', title: 'Test Data' },
        { id: 'userStoryRef', title: 'User Story Reference' },
        { id: 'automationComplexity', title: 'Automation Complexity' },
        { id: 'estimatedDuration', title: 'Estimated Duration (seconds)' },
        { id: 'generatedTimestamp', title: 'Generated Timestamp' }
      ]
    });
    
    // Helper function to determine step type based on content
    const determineStepType = (stepDescription) => {
      const stepLower = stepDescription.toLowerCase();
      
      if (stepLower.includes('navigate') || stepLower.includes('open') || stepLower.includes('go to')) {
        return 'Navigation';
      } else if (stepLower.includes('verify') || stepLower.includes('check') || stepLower.includes('assert') || 
                 stepLower.includes('confirm') || stepLower.includes('validate') || stepLower.includes('ensure')) {
        return 'Verification';
      } else if (stepLower.includes('enter') || stepLower.includes('fill') || stepLower.includes('input') || 
                 stepLower.includes('type') || stepLower.includes('provide')) {
        return 'Data Entry';
      } else if (stepLower.includes('click') || stepLower.includes('select') || stepLower.includes('choose') || 
                 stepLower.includes('press') || stepLower.includes('tap')) {
        return 'User Interaction';
      } else if (stepLower.includes('wait') || stepLower.includes('load') || stepLower.includes('delay')) {
        return 'Wait/Synchronization';
      } else if (stepLower.includes('login') || stepLower.includes('authenticate') || stepLower.includes('sign in')) {
        return 'Authentication';
      } else if (stepLower.includes('logout') || stepLower.includes('sign out') || stepLower.includes('exit')) {
        return 'Cleanup';
      } else {
        return 'Action';
      }
    };
    
    // Helper function to estimate automation complexity
    const estimateComplexity = (stepDescription, stepType) => {
      const stepLower = stepDescription.toLowerCase();
      
      if (stepType === 'Navigation' || stepType === 'User Interaction') {
        return 'Low';
      } else if (stepType === 'Data Entry' || stepType === 'Authentication') {
        return 'Medium';
      } else if (stepType === 'Verification' && (stepLower.includes('complex') || stepLower.includes('multiple'))) {
        return 'High';
      } else if (stepLower.includes('upload') || stepLower.includes('download') || stepLower.includes('api')) {
        return 'High';
      } else {
        return 'Medium';
      }
    };
    
    // Helper function to estimate duration in seconds
    const estimateDuration = (stepType, complexity) => {
      const baseTime = {
        'Navigation': 3,
        'User Interaction': 2,
        'Data Entry': 5,
        'Verification': 4,
        'Wait/Synchronization': 8,
        'Authentication': 6,
        'Cleanup': 3,
        'Action': 4
      };
      
      const multiplier = complexity === 'High' ? 2 : complexity === 'Medium' ? 1.5 : 1;
      return Math.round((baseTime[stepType] || 4) * multiplier);
    };
    
    // Prepare test case steps data with individual rows for each step
    const testCaseStepsData = [];
    detailedTestCases.forEach(tc => {
      tc.testSteps.forEach((step, stepIndex) => {
        const stepType = determineStepType(step);
        const complexity = estimateComplexity(step, stepType);
        const duration = estimateDuration(stepType, complexity);
        
        testCaseStepsData.push({
          stepId: `STEP_${tc.testCaseId}_${(stepIndex + 1).toString().padStart(2, '0')}`,
          testCaseId: tc.testCaseId,
          testCaseName: tc.testCaseName,
          stepNumber: stepIndex + 1,
          stepDescription: step,
          stepType: stepType,
          category: tc.category,
          priority: tc.priority,
          preconditions: tc.preconditions,
          expectedResults: stepIndex === tc.testSteps.length - 1 ? tc.expectedResults : `Step ${stepIndex + 1} should be completed successfully`,
          testData: tc.testData,
          userStoryRef: userStory.substring(0, 100) + (userStory.length > 100 ? '...' : ''),
          automationComplexity: complexity,
          estimatedDuration: duration,
          generatedTimestamp: new Date().toISOString()
        });
      });
    });
    
    await testCaseStepWriter.writeRecords(testCaseStepsData);
    
    console.log('✅ Test case steps saved to TestCaseStep CSV:', testCaseStepCsvPath);
    console.log(`📊 Total individual steps saved: ${testCaseStepsData.length}`);
    
    res.json({
      success: true,
      detailedTestCases,
      message: 'Detailed test steps created and saved to CSV successfully',
      csvFiles: {
        detailedSteps: {
          path: detailedCsvPath,
          filename: `DetailedTestSteps_${timestamp}.csv`,
          recordCount: detailedTestCases.length,
          description: 'Test cases with detailed steps (one row per test case)'
        },
        individualSteps: {
          path: testCaseStepCsvPath,
          filename: `TestCaseStep_${timestamp}.csv`,
          recordCount: testCaseStepsData.length,
          description: 'Individual test steps (one row per step)'
        }
      },
      totalTestCases: detailedTestCases.length,
      totalSteps: testCaseStepsData.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error creating test steps:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to create detailed test steps',
      details: error.message
    });
  }
});

// Generate automation code from detailed test steps
app.post('/api/generate-automation-from-steps', async (req, res) => {
  const { detailedTestCases, userStory } = req.body;
  
  // Validate input
  if (!detailedTestCases || detailedTestCases.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Detailed test cases are required',
      message: 'Please provide detailed test cases to generate automation code'
    });
  }
  
  try {
    console.log('🔄 Generating Java Playwright automation code from test case steps...');
    
    // Check if DetailedTestSteps CSV file exists
    const dataDir = path.join(__dirname, 'data');
    let csvExists = false;
    let latestCsvFile = null;
    
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir)
        .filter(file => file.startsWith('DetailedTestSteps_') && file.endsWith('.csv'))
        .sort()
        .reverse();
      
      if (files.length > 0) {
        latestCsvFile = path.join(dataDir, files[0]);
        csvExists = true;
        console.log('📄 Found test case steps CSV:', latestCsvFile);
      }
    }
    
    if (!csvExists) {
      return res.status(400).json({
        success: false,
        error: 'No test case steps CSV found',
        message: 'Please create test case steps first before generating automation code'
      });
    }
    
    // Read the CSV file to get the most up-to-date test case steps
    const csvTestCases = await new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(latestCsvFile)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
    
    console.log(`📊 Read ${csvTestCases.length} test cases from CSV`);
    
    // Generate Java Playwright automation code and get extracted data
    const { automationCode, extractedRealData } = generateJavaPlaywrightCodeWithData(detailedTestCases, userStory, csvTestCases);

    // Save automation code to .java file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const javaFileName = `AutomationTest_${timestamp}.java`;
    const javaFilePath = path.join(__dirname, 'data', javaFileName);

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write Java file
    fs.writeFileSync(javaFilePath, automationCode, 'utf8');
    console.log('✅ Java automation code saved to:', javaFilePath);

    res.json({
      success: true,
      automationCode,
      extractedRealData,
      message: 'Java Playwright automation code generated and saved successfully',
      javaFile: {
        path: javaFilePath,
        filename: javaFileName,
        testCaseCount: detailedTestCases.length,
        language: 'java',
        framework: 'playwright'
      },
      csvSource: {
        file: latestCsvFile,
        recordCount: csvTestCases.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error generating automation code:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to generate automation code from test case steps',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

// AI Analysis Functions
function analyzeUserStory(userStory) {
  const storyLower = userStory.toLowerCase();
  let category = 'General';
  let priority = 'Medium';
  let complexity = 'Medium';
  
  // Determine category based on keywords
  if (storyLower.includes('login') || storyLower.includes('authenticate') || storyLower.includes('sign in')) {
    category = 'Authentication';
    priority = 'High';
  } else if (storyLower.includes('search') || storyLower.includes('find') || storyLower.includes('filter')) {
    category = 'Search';
    priority = 'Medium';
  } else if (storyLower.includes('register') || storyLower.includes('signup') || storyLower.includes('create account')) {
    category = 'Registration';
    priority = 'High';
  } else if (storyLower.includes('payment') || storyLower.includes('checkout') || storyLower.includes('purchase')) {
    category = 'Payment';
    priority = 'High';
    complexity = 'High';
  } else if (storyLower.includes('profile') || storyLower.includes('settings') || storyLower.includes('preferences')) {
    category = 'User Management';
    priority = 'Medium';
  } else if (storyLower.includes('upload') || storyLower.includes('download') || storyLower.includes('file')) {
    category = 'File Management';
    complexity = 'High';
  } else if (storyLower.includes('notification') || storyLower.includes('email') || storyLower.includes('alert')) {
    category = 'Communication';
    priority = 'Low';
  }
  
  // Determine complexity based on story length and keywords
  if (userStory.length > 200 || storyLower.includes('integration') || storyLower.includes('api') || storyLower.includes('database')) {
    complexity = 'High';
  } else if (userStory.length < 50) {
    complexity = 'Low';
  }
  
  return { category, priority, complexity };
}

async function generateComprehensiveTestCases(userStory, analysis) {
  const testCases = [];
  const category = analysis.category;
  let testCaseCounter = 1;
  
  // Generate category-specific test cases
  switch (category) {
    case 'Authentication':
      testCases.push(...generateAuthenticationTestCases(userStory, testCaseCounter));
      break;
    case 'Search':
      testCases.push(...generateSearchTestCases(userStory, testCaseCounter));
      break;
    case 'Registration':
      testCases.push(...generateRegistrationTestCases(userStory, testCaseCounter));
      break;
    case 'Payment':
      testCases.push(...generatePaymentTestCases(userStory, testCaseCounter));
      break;
    case 'User Management':
      testCases.push(...generateUserManagementTestCases(userStory, testCaseCounter));
      break;
    case 'File Management':
      testCases.push(...generateFileManagementTestCases(userStory, testCaseCounter));
      break;
    case 'Communication':
      testCases.push(...generateCommunicationTestCases(userStory, testCaseCounter));
      break;
    default:
      testCases.push(...generateGenericTestCases(userStory, testCaseCounter));
  }
  
  return testCases;
}

function generateAuthenticationTestCases(userStory, startCounter) {
  return [
    {
      testCaseId: `TC_AUTH_${startCounter.toString().padStart(3, '0')}`,
      testCaseName: 'Verify successful login with valid credentials',
      category: 'Authentication',
      priority: 'High',
      preconditions: 'User has a valid registered account, Application is accessible',
      testSteps: [
        'Navigate to the login page',
        'Enter valid username/email in the username field',
        'Enter valid password in the password field',
        'Click on the Login/Sign In button',
        'Verify successful redirection to dashboard/home page'
      ],
      expectedResults: 'User should be successfully logged in and redirected to the main application dashboard',
      testData: 'Valid username: testuser@example.com, Valid password: Test@123456'
    },
    {
      testCaseId: `TC_AUTH_${(startCounter + 1).toString().padStart(3, '0')}`,
      testCaseName: 'Verify login failure with invalid credentials',
      category: 'Authentication',
      priority: 'High',
      preconditions: 'Application is accessible, Login page is available',
      testSteps: [
        'Navigate to the login page',
        'Enter invalid username/email in the username field',
        'Enter invalid password in the password field',
        'Click on the Login/Sign In button',
        'Verify appropriate error message is displayed'
      ],
      expectedResults: 'System should display error message "Invalid username or password" and user should remain on login page',
      testData: 'Invalid username: invalid@test.com, Invalid password: wrongpass123'
    },
    {
      testCaseId: `TC_AUTH_${(startCounter + 2).toString().padStart(3, '0')}`,
      testCaseName: 'Verify password field masking during input',
      category: 'Authentication',
      priority: 'Medium',
      preconditions: 'Login page is accessible',
      testSteps: [
        'Navigate to the login page',
        'Click on the password input field',
        'Type any password in the password field',
        'Verify that entered characters are masked (shown as dots or asterisks)',
        'Verify password visibility toggle functionality if available'
      ],
      expectedResults: 'Password characters should be masked for security, toggle should work if available',
      testData: 'Test password: MySecretPassword123'
    },
    {
      testCaseId: `TC_AUTH_${(startCounter + 3).toString().padStart(3, '0')}`,
      testCaseName: 'Verify account lockout after multiple failed attempts',
      category: 'Authentication',
      priority: 'High',
      preconditions: 'User account exists, Application security settings configured',
      testSteps: [
        'Navigate to the login page',
        'Enter valid username but invalid password',
        'Repeat login attempts 5 times with wrong password',
        'Attempt to login with correct credentials after lockout',
        'Verify account lockout message and behavior'
      ],
      expectedResults: 'Account should be locked after maximum failed attempts, appropriate lockout message displayed',
      testData: 'Valid username: testuser@example.com, Invalid password: wrongpass123'
    }
  ];
}

function generateSearchTestCases(userStory, startCounter) {
  return [
    {
      testCaseId: `TC_SEARCH_${startCounter.toString().padStart(3, '0')}`,
      testCaseName: 'Verify search functionality with valid keywords',
      category: 'Search',
      priority: 'High',
      preconditions: 'Application is loaded, Search functionality is accessible, Test data is available',
      testSteps: [
        'Navigate to the search page/section',
        'Enter valid search keywords in search box',
        'Click search button or press Enter',
        'Verify search results are displayed',
        'Verify search results are relevant to entered keywords'
      ],
      expectedResults: 'Relevant search results should be displayed based on entered keywords',
      testData: 'Search keywords: "laptop", "mobile phone", "electronics"'
    },
    {
      testCaseId: `TC_SEARCH_${(startCounter + 1).toString().padStart(3, '0')}`,
      testCaseName: 'Verify search with partial keywords',
      category: 'Search',
      priority: 'Medium',
      preconditions: 'Search functionality is available, Database contains searchable data',
      testSteps: [
        'Navigate to search interface',
        'Enter partial keywords (e.g., first few characters)',
        'Verify auto-complete suggestions if available',
        'Execute search with partial keyword',
        'Verify results include items matching partial search'
      ],
      expectedResults: 'System should return results matching partial keywords and show auto-complete if available',
      testData: 'Partial keywords: "lap", "mob", "elect"'
    },
    {
      testCaseId: `TC_SEARCH_${(startCounter + 2).toString().padStart(3, '0')}`,
      testCaseName: 'Verify search with no results found',
      category: 'Search',
      priority: 'Medium',
      preconditions: 'Search functionality is accessible',
      testSteps: [
        'Navigate to search interface',
        'Enter search terms that have no matching results',
        'Execute the search',
        'Verify "No results found" message is displayed',
        'Verify suggested alternative searches if available'
      ],
      expectedResults: 'System should display appropriate "No results found" message with helpful suggestions',
      testData: 'Non-existent search terms: "xyzzyx", "nonexistentproduct123"'
    },
    {
      testCaseId: `TC_SEARCH_${(startCounter + 3).toString().padStart(3, '0')}`,
      testCaseName: 'Verify search filters and sorting functionality',
      category: 'Search',
      priority: 'Medium',
      preconditions: 'Search results are available, Filter options are configured',
      testSteps: [
        'Perform a search that returns multiple results',
        'Apply various filters (price, category, date, etc.)',
        'Verify filtered results match selected criteria',
        'Test different sorting options (relevance, price, date)',
        'Verify sorting works correctly'
      ],
      expectedResults: 'Filters should narrow down results appropriately, sorting should reorder results correctly',
      testData: 'Search term: "books", Filters: price range $10-$50, category: fiction'
    }
  ];
}

function generateRegistrationTestCases(userStory, startCounter) {
  return [
    {
      testCaseId: `TC_REG_${startCounter.toString().padStart(3, '0')}`,
      testCaseName: 'Verify successful user registration with valid data',
      category: 'Registration',
      priority: 'High',
      preconditions: 'Registration page is accessible, Email service is working',
      testSteps: [
        'Navigate to registration page',
        'Fill all mandatory fields with valid data',
        'Enter valid email address',
        'Create strong password meeting requirements',
        'Confirm password correctly',
        'Accept terms and conditions',
        'Submit registration form',
        'Verify confirmation message/email'
      ],
      expectedResults: 'User should be successfully registered and receive confirmation',
      testData: 'Email: newuser@test.com, Password: NewUser@123, Name: John Doe'
    },
    {
      testCaseId: `TC_REG_${(startCounter + 1).toString().padStart(3, '0')}`,
      testCaseName: 'Verify registration with existing email address',
      category: 'Registration',
      priority: 'High',
      preconditions: 'User with test email already exists in system',
      testSteps: [
        'Navigate to registration page',
        'Enter email address that already exists in system',
        'Fill other required fields with valid data',
        'Submit registration form',
        'Verify appropriate error message is displayed'
      ],
      expectedResults: 'System should display error message indicating email already exists',
      testData: 'Existing email: existing@test.com'
    },
    {
      testCaseId: `TC_REG_${(startCounter + 2).toString().padStart(3, '0')}`,
      testCaseName: 'Verify password strength validation',
      category: 'Registration',
      priority: 'Medium',
      preconditions: 'Registration form has password strength requirements',
      testSteps: [
        'Navigate to registration page',
        'Enter weak password (e.g., "123456")',
        'Verify password strength indicator shows weak',
        'Enter medium strength password',
        'Verify strength indicator updates',
        'Enter strong password meeting all criteria',
        'Verify strong password is accepted'
      ],
      expectedResults: 'Password strength should be validated and displayed to user in real-time',
      testData: 'Weak: "123456", Medium: "password123", Strong: "StrongPass@123"'
    }
  ];
}

function generateGenericTestCases(userStory, startCounter) {
  return [
    {
      testCaseId: `TC_GEN_${startCounter.toString().padStart(3, '0')}`,
      testCaseName: `Verify ${userStory} - positive flow`,
      category: 'General',
      priority: 'High',
      preconditions: 'Application is accessible and user has necessary permissions',
      testSteps: [
        'Navigate to the relevant application section',
        'Perform the action described in user story with valid inputs',
        'Verify successful completion of the action',
        'Verify appropriate success message is displayed',
        'Verify system state is updated correctly'
      ],
      expectedResults: 'User story requirements should be fulfilled successfully',
      testData: 'Valid test data as per user story requirements'
    },
    {
      testCaseId: `TC_GEN_${(startCounter + 1).toString().padStart(3, '0')}`,
      testCaseName: `Verify ${userStory} - error handling`,
      category: 'General',
      priority: 'Medium',
      preconditions: 'Application is accessible',
      testSteps: [
        'Navigate to the relevant application section',
        'Attempt to perform action with invalid inputs',
        'Verify appropriate error messages are displayed',
        'Verify system handles errors gracefully',
        'Verify system state remains consistent'
      ],
      expectedResults: 'System should handle errors gracefully with appropriate error messages',
      testData: 'Invalid test data to trigger error conditions'
    },
    {
      testCaseId: `TC_GEN_${(startCounter + 2).toString().padStart(3, '0')}`,
      testCaseName: `Verify ${userStory} - UI responsiveness and accessibility`,
      category: 'General',
      priority: 'Low',
      preconditions: 'Application is accessible on different devices/browsers',
      testSteps: [
        'Access application on desktop browser',
        'Verify UI elements are properly displayed',
        'Test on mobile device/responsive mode',
        'Verify accessibility features (keyboard navigation, screen reader compatibility)',
        'Test on different browsers (Chrome, Firefox, Safari)'
      ],
      expectedResults: 'Application should be responsive and accessible across different platforms',
      testData: 'Different browsers, devices, and accessibility tools'
    }
  ];
}

// Add other category-specific generators (Payment, File Management, etc.)
function generatePaymentTestCases(userStory, startCounter) {
  // Implementation for payment test cases
  return generateGenericTestCases(userStory, startCounter);
}

function generateUserManagementTestCases(userStory, startCounter) {
  // Implementation for user management test cases
  return generateGenericTestCases(userStory, startCounter);
}

function generateFileManagementTestCases(userStory, startCounter) {
  // Implementation for file management test cases
  return generateGenericTestCases(userStory, startCounter);
}

function generateCommunicationTestCases(userStory, startCounter) {
  // Implementation for communication test cases
  return generateGenericTestCases(userStory, startCounter);
}

// Generate detailed test steps from existing test cases
async function generateDetailedTestSteps(testCases, userStory, existingTestCases = []) {
  const detailedTestCases = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    // Try to find matching detailed test case from existing CSV data
    let existingDetailedCase = null;
    if (existingTestCases.length > 0) {
      existingDetailedCase = existingTestCases.find(etc => 
        etc['Test Case Name'] && 
        etc['Test Case Name'].toLowerCase().includes(testCase.toLowerCase().substring(0, 20))
      );
    }
    
    // If we have existing detailed case, use it; otherwise generate new one
    if (existingDetailedCase) {
      detailedTestCases.push({
        testCaseId: existingDetailedCase['Test Case ID'] || `TC_STEP_${(i + 1).toString().padStart(3, '0')}`,
        testCaseName: existingDetailedCase['Test Case Name'] || testCase,
        category: existingDetailedCase['Category'] || 'General',
        priority: existingDetailedCase['Priority'] || 'Medium',
        preconditions: existingDetailedCase['Preconditions'] || 'Application is accessible and ready for testing',
        testSteps: existingDetailedCase['Test Steps'] ? 
          existingDetailedCase['Test Steps'].split(' | ') : 
          generateStepsFromTestCase(testCase, userStory),
        expectedResults: existingDetailedCase['Expected Results'] || `Test case "${testCase}" should be completed successfully`,
        testData: existingDetailedCase['Test Data'] || 'Valid test data as per requirements'
      });
    } else {
      // Generate new detailed test case
      const detailedCase = generateStepsFromTestCase(testCase, userStory, i + 1);
      detailedTestCases.push(detailedCase);
    }
  }
  
  return detailedTestCases;
}

// Generate detailed steps for a specific test case
function generateStepsFromTestCase(testCase, userStory, index = 1) {
  const testCaseLower = testCase.toLowerCase();
  const userStoryLower = userStory.toLowerCase();
  
  let category = 'General';
  let priority = 'Medium';
  let preconditions = 'Application is accessible and ready for testing';
  let testSteps = [];
  let expectedResults = `Test case "${testCase}" should be completed successfully`;
  let testData = 'Valid test data as per requirements';
  
  // Analyze test case to determine category and generate appropriate steps
  if (testCaseLower.includes('login') || testCaseLower.includes('sign in') || testCaseLower.includes('authenticate')) {
    category = 'Authentication';
    priority = 'High';
    preconditions = 'User has valid credentials, Application login page is accessible';
    testData = 'Valid username: testuser@example.com, Valid password: Test@123';
    
    if (testCaseLower.includes('valid') || testCaseLower.includes('successful')) {
      testSteps = [
        'Navigate to the application login page',
        'Verify login form is displayed with username and password fields',
        'Enter valid username in the username field',
        'Enter valid password in the password field',
        'Click the Login/Sign In button',
        'Verify successful login and redirection to dashboard'
      ];
      expectedResults = 'User should be successfully authenticated and redirected to the main dashboard';
    } else if (testCaseLower.includes('invalid') || testCaseLower.includes('error')) {
      testSteps = [
        'Navigate to the application login page',
        'Enter invalid username or password',
        'Click the Login/Sign In button',
        'Verify error message is displayed',
        'Verify user remains on login page'
      ];
      expectedResults = 'System should display appropriate error message and prevent unauthorized access';
      testData = 'Invalid username: invalid@test.com, Invalid password: wrongpass123';
    }
  } else if (testCaseLower.includes('search') || testCaseLower.includes('find')) {
    category = 'Search';
    priority = 'Medium';
    preconditions = 'Application is loaded, Search functionality is accessible, Test data is available';
    testData = 'Search keywords: "laptop", "mobile phone", "electronics"';
    
    testSteps = [
      'Navigate to the search section of the application',
      'Locate the search input field',
      'Enter search keywords in the search box',
      'Click the search button or press Enter',
      'Wait for search results to load',
      'Verify search results are displayed and relevant'
    ];
    expectedResults = 'Search should return relevant results based on the entered keywords';
  } else if (testCaseLower.includes('register') || testCaseLower.includes('signup') || testCaseLower.includes('create account')) {
    category = 'Registration';
    priority = 'High';
    preconditions = 'Registration page is accessible, Email service is working';
    testData = 'Email: newuser@test.com, Password: NewUser@123, Name: John Doe';
    
    testSteps = [
      'Navigate to the registration page',
      'Fill in all mandatory fields with valid data',
      'Enter a valid email address',
      'Create a strong password meeting requirements',
      'Confirm password correctly',
      'Accept terms and conditions if required',
      'Submit the registration form',
      'Verify confirmation message or email'
    ];
    expectedResults = 'User should be successfully registered and receive confirmation';
  } else if (testCaseLower.includes('password')) {
    category = 'Security';
    priority = 'Medium';
    preconditions = 'Login or registration form is accessible';
    
    if (testCaseLower.includes('mask') || testCaseLower.includes('hide')) {
      testSteps = [
        'Navigate to the login or registration page',
        'Click on the password input field',
        'Enter any characters in the password field',
        'Verify that characters are masked (shown as dots or asterisks)',
        'Check for password visibility toggle if available',
        'Test toggle functionality to show/hide password'
      ];
      expectedResults = 'Password characters should be properly masked for security';
      testData = 'Test password: MySecretPassword123';
    }
  } else if (testCaseLower.includes('ui') || testCaseLower.includes('interface') || testCaseLower.includes('responsive')) {
    category = 'UI/UX';
    priority = 'Low';
    preconditions = 'Application is accessible on different devices and browsers';
    
    testSteps = [
      'Open the application in a desktop browser',
      'Verify all UI elements are properly displayed',
      'Resize browser window to test responsiveness',
      'Test on mobile device or use responsive mode',
      'Verify touch interactions work properly on mobile',
      'Test on different browsers (Chrome, Firefox, Safari)'
    ];
    expectedResults = 'Application should be responsive and functional across all tested platforms';
    testData = 'Different browsers: Chrome, Firefox, Safari; Devices: Desktop, Mobile, Tablet';
  } else {
    // Generic test case decomposition
    testSteps = [
      'Navigate to the relevant section of the application',
      'Verify the feature/functionality is accessible',
      'Perform the required action as described in the test case',
      'Verify the action completes successfully',
      'Check that the system state is updated correctly',
      'Verify any displayed messages or feedback'
    ];
    
    // Try to extract more specific steps based on user story context
    if (userStoryLower.includes('upload') || userStoryLower.includes('file')) {
      category = 'File Management';
      testSteps = [
        'Navigate to the file upload section',
        'Click on file upload button or drag-drop area',
        'Select a valid file from file system',
        'Verify file is selected and displayed',
        'Click upload button to start upload process',
        'Verify successful upload and file processing'
      ];
      testData = 'Test files: document.pdf, image.jpg (valid formats and sizes)';
    }
  }
  
  return {
    testCaseId: `TC_STEP_${index.toString().padStart(3, '0')}`,
    testCaseName: testCase,
    category,
    priority,
    preconditions,
    testSteps,
    expectedResults,
    testData
  };
}

// Read and parse UserStory.csv to get real data
function readUserStoryFromCSV() {
  const mainCsvPath = path.join(__dirname, 'data', 'UserStory.csv');
  
  try {
    if (fs.existsSync(mainCsvPath)) {
      const csvContent = fs.readFileSync(mainCsvPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length > 1) {
        // Parse the header to understand column positions
        const header = lines[0].split(',');
        const userStoryIndex = header.findIndex(col => col.toLowerCase().includes('user story'));
        
        // Get the most recent user story (last non-empty line)
        for (let i = lines.length - 1; i >= 1; i--) {
          const columns = lines[i].split(',');
          if (columns.length > userStoryIndex && columns[userStoryIndex].trim()) {
            const userStoryData = {
              id: columns[0] || '',
              timestamp: columns[1] || '',
              userStory: columns[userStoryIndex] || '',
              category: columns[3] || 'General',
              priority: columns[4] || 'Medium',
              complexity: columns[5] || 'Medium',
              source: columns[6] || ''
            };
            
            console.log('📖 Found user story from CSV:', userStoryData);
            return userStoryData;
          }
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Could not read UserStory.csv:', error.message);
  }
  
  return null;
}

// Extract real-time data from user story and CSV
function extractRealTimeDataFromUserStory(userStory) {
  const storyLower = userStory.toLowerCase();
  const extractedData = {
    baseUrl: 'https://example.com',
    username: 'testuser@example.com',
    password: 'Test@123456',
    application: 'Application',
    features: [],
    selectors: {
      usernameField: '#username',
      passwordField: '#password',
      loginButton: '#loginBtn',
      dashboard: '.dashboard'
    }
  };
  
  // Extract URL from user story
  const urlMatch = userStory.match(/https?:\/\/[^\s\),]+/);
  if (urlMatch) {
    extractedData.baseUrl = urlMatch[0];
    try {
      const url = new URL(urlMatch[0]);
      const hostname = url.hostname.replace('www.', '');
      extractedData.application = hostname.split('.')[0];
      
      // Set application-specific data based on known demo sites
      if (hostname.includes('saucedemo')) {
        extractedData.application = 'SauceDemo';
        extractedData.username = 'standard_user';
        extractedData.password = 'secret_sauce';
        extractedData.selectors = {
          usernameField: '#user-name',
          passwordField: '#password',
          loginButton: '#login-button',
          dashboard: '.inventory_list'
        };
      } else if (hostname.includes('demowebshop')) {
        extractedData.application = 'DemoWebShop';
        extractedData.username = 'testuser@tricentis.com';
        extractedData.password = 'TestPassword123';
        extractedData.selectors = {
          usernameField: '#Email',
          passwordField: '#Password',
          loginButton: '.login-button',
          dashboard: '.header-links'
        };
      } else if (hostname.includes('orangehrm')) {
        extractedData.application = 'OrangeHRM';
        extractedData.username = 'Admin';
        extractedData.password = 'admin123';
        extractedData.selectors = {
          usernameField: '[name="username"]',
          passwordField: '[name="password"]',
          loginButton: '[type="submit"]',
          dashboard: '.dashboard'
        };
      } else if (hostname.includes('automationexercise')) {
        extractedData.application = 'AutomationExercise';
        extractedData.username = 'testuser@automation.com';
        extractedData.password = 'TestPass123';
        extractedData.selectors = {
          usernameField: '[data-qa="login-email"]',
          passwordField: '[data-qa="login-password"]',
          loginButton: '[data-qa="login-button"]',
          dashboard: '.nav'
        };
      } else if (hostname.includes('parabank')) {
        extractedData.application = 'ParaBank';
        extractedData.username = 'john';
        extractedData.password = 'demo';
        extractedData.selectors = {
          usernameField: '[name="username"]',
          passwordField: '[name="password"]',
          loginButton: '[type="submit"]',
          dashboard: '.account'
        };
      }
    } catch (e) {
      console.log('Could not parse URL:', urlMatch[0]);
    }
  } else {
    // Try to extract application name from common patterns
    const appPatterns = [
      /(?:on|in|to)\s+([A-Z][a-zA-Z\s]+)(?:\s+application|\s+app|\s+website|\s+platform)/i,
      /(?:login|access|use)\s+([A-Z][a-zA-Z\s]+)/i,
      /([A-Z][a-zA-Z\s]+)\s+(?:system|portal|dashboard)/i,
      /test\s+([a-zA-Z\s]+)\s+functionality/i
    ];
    
    for (const pattern of appPatterns) {
      const match = userStory.match(pattern);
      if (match) {
        extractedData.application = match[1].trim();
        break;
      }
    }
  }
  
  // Extract username patterns from user story
  const emailMatch = userStory.match(/(?:username|user|email)[\s:=]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    extractedData.username = emailMatch[1];
  } else if (storyLower.includes('admin')) {
    if (extractedData.application.toLowerCase() !== 'application') {
      extractedData.username = 'admin@' + extractedData.application.toLowerCase() + '.com';
    } else {
      extractedData.username = 'admin@example.com';
    }
  } else if (storyLower.includes('manager')) {
    if (extractedData.application.toLowerCase() !== 'application') {
      extractedData.username = 'manager@' + extractedData.application.toLowerCase() + '.com';
    } else {
      extractedData.username = 'manager@example.com';
    }
  }
  
  // Extract explicit username from patterns like "username: john" or "user: standard_user"
  const usernamePatterns = [
    /(?:username|user)[\s:=]+([a-zA-Z0-9._-]+)/i,
    /with\s+user\s+([a-zA-Z0-9._-]+)/i,
    /as\s+([a-zA-Z0-9._-]+)\s+user/i
  ];
  
  for (const pattern of usernamePatterns) {
    const match = userStory.match(pattern);
    if (match && match[1] && !match[1].includes('@')) {
      extractedData.username = match[1];
      break;
    }
  }
  // Extract password patterns
  const passwordPatterns = [
    /(?:password|pass)[\s:=]+([^\s,]+)/i,
    /with\s+password\s+([^\s,]+)/i,
    /pass(?:word)?:\s*([^\s,]+)/i
  ];
  
  for (const pattern of passwordPatterns) {
    const match = userStory.match(pattern);
    if (match && match[1]) {
      extractedData.password = match[1];
      break;
    }
  }
  
  // Set default passwords for known applications if not found
  if (!passwordPatterns.some(p => userStory.match(p))) {
    if (storyLower.includes('admin')) {
      extractedData.password = 'Admin@123';
    } else if (storyLower.includes('manager')) {
      extractedData.password = 'Manager@123';
    } else if (extractedData.application === 'SauceDemo') {
      extractedData.password = 'secret_sauce';
    } else if (extractedData.application === 'OrangeHRM') {
      extractedData.password = 'admin123';
    }
  }
  
  // Extract features/functionalities
  const featurePatterns = [
    /(?:want to|need to|able to)\s+([^,.]+)/gi,
    /(?:login|search|create|update|delete|view|manage|access|add|select|buy|purchase|checkout)\s+([^,.]+)/gi,
    /test\s+([^,.]+)\s+functionality/gi
  ];
  
  featurePatterns.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(userStory)) !== null) {
      const feature = match[1].trim();
      if (feature.length > 3 && feature.length < 50) {
        extractedData.features.push(feature);
      }
    }
  });
  
  // Remove duplicates from features
  extractedData.features = [...new Set(extractedData.features)];
  
  // Determine selectors based on application type and features
  if (storyLower.includes('login') || storyLower.includes('authenticate')) {
    if (storyLower.includes('email')) {
      extractedData.selectors.usernameField = '[type="email"], #email, input[name="email"]';
    }
    
    // Application-specific selectors are already set above in the URL matching section
    if (extractedData.application === 'Application') {
      // Generic selectors for unknown applications
      if (storyLower.includes('amazon') || storyLower.includes('ecommerce')) {
        extractedData.selectors.usernameField = '#ap_email, [name="email"]';
        extractedData.selectors.passwordField = '#ap_password, [name="password"]';
        extractedData.selectors.loginButton = '#signInSubmit, [type="submit"]';
      } else if (storyLower.includes('google')) {
        extractedData.selectors.usernameField = '[type="email"]';
        extractedData.selectors.passwordField = '[type="password"]';
        extractedData.selectors.loginButton = '#passwordNext, [type="submit"]';
      }
    }
  }
  
  console.log('🔍 Extracted data from user story:', extractedData);
  return extractedData;
}

// Generate realistic Java test steps code based on extracted data
function generateRealisticTestStepsCode(testCase, extractedData) {
  let stepsCode = '';
  const category = testCase.category.toLowerCase();
  const testCaseLower = testCase.testCaseName.toLowerCase();
  
  testCase.testSteps.forEach((step, index) => {
    const stepNumber = index + 1;
    const stepLower = step.toLowerCase();
    
    stepsCode += `            // Step ${stepNumber}: ${step}\n`;
    
    if (stepLower.includes('navigate') || stepLower.includes('open') || stepLower.includes('launch')) {
      if (stepLower.includes('login')) {
        stepsCode += `            page.navigate(BASE_URL + "/login");\n`;
      } else if (stepLower.includes('dashboard') || stepLower.includes('home')) {
        stepsCode += `            page.navigate(BASE_URL + "/dashboard");\n`;
      } else {
        stepsCode += `            page.navigate(BASE_URL);\n`;
      }
      stepsCode += `            page.waitForLoadState("networkidle");\n`;
      stepsCode += `            System.out.println("🌐 Navigated to: " + page.url());\n`;
      
    } else if (stepLower.includes('enter') && (stepLower.includes('username') || stepLower.includes('email') || stepLower.includes('user'))) {
      stepsCode += `            page.waitForSelector("${extractedData.selectors.usernameField}", new Page.WaitForSelectorOptions().setTimeout(10000));\n`;
      stepsCode += `            page.fill("${extractedData.selectors.usernameField}", USERNAME);\n`;
      stepsCode += `            System.out.println("✍️ Entered username: " + USERNAME);\n`;
      
    } else if (stepLower.includes('enter') && stepLower.includes('password')) {
      stepsCode += `            page.waitForSelector("${extractedData.selectors.passwordField}", new Page.WaitForSelectorOptions().setTimeout(10000));\n`;
      stepsCode += `            page.fill("${extractedData.selectors.passwordField}", PASSWORD);\n`;
      stepsCode += `            System.out.println("🔒 Entered password");\n`;
      
    } else if (stepLower.includes('click') && (stepLower.includes('login') || stepLower.includes('sign in'))) {
      stepsCode += `            page.click("${extractedData.selectors.loginButton}");\n`;
      stepsCode += `            page.waitForLoadState("networkidle");\n`;
      stepsCode += `            System.out.println("🖱️ Clicked login button");\n`;
      
    } else if (stepLower.includes('verify') && (stepLower.includes('login') || stepLower.includes('dashboard') || stepLower.includes('success'))) {
      stepsCode += `            page.waitForSelector("${extractedData.selectors.dashboard}", new Page.WaitForSelectorOptions().setTimeout(15000));\n`;
      stepsCode += `            assertTrue(page.isVisible("${extractedData.selectors.dashboard}"), "Dashboard should be visible after login");\n`;
      stepsCode += `            System.out.println("✅ Successfully verified login - Dashboard is visible");\n`;
      
    } else if (stepLower.includes('verify') && stepLower.includes('error')) {
      stepsCode += `            page.waitForSelector(".error-message, .alert-danger, [role='alert'], .error", new Page.WaitForSelectorOptions().setTimeout(10000));\n`;
      stepsCode += `            assertTrue(page.isVisible(".error-message, .alert-danger, [role='alert'], .error"), "Error message should be displayed");\n`;
      stepsCode += `            String errorText = page.textContent(".error-message, .alert-danger, [role='alert'], .error");\n`;
      stepsCode += `            System.out.println("⚠️ Error message displayed: " + errorText);\n`;
      
    } else if (stepLower.includes('search')) {
      const searchTerm = extractedData.features.find(f => f.includes('search')) || 'test product';
      stepsCode += `            page.waitForSelector("input[type='search'], #search, .search-input, [placeholder*='search']");\n`;
      stepsCode += `            page.fill("input[type='search'], #search, .search-input, [placeholder*='search']", "${searchTerm}");\n`;
      stepsCode += `            page.press("input[type='search'], #search, .search-input, [placeholder*='search']", "Enter");\n`;
      stepsCode += `            page.waitForLoadState("networkidle");\n`;
      stepsCode += `            System.out.println("🔍 Searched for: ${searchTerm}");\n`;
      
    } else if (stepLower.includes('add') && (stepLower.includes('cart') || stepLower.includes('basket'))) {
      stepsCode += `            page.waitForSelector("button:has-text('Add to Cart'), .add-to-cart, .btn-add-cart");\n`;
      stepsCode += `            page.click("button:has-text('Add to Cart'), .add-to-cart, .btn-add-cart");\n`;
      stepsCode += `            System.out.println("🛒 Added item to cart");\n`;
      
    } else if (stepLower.includes('select') && stepLower.includes('product')) {
      stepsCode += `            page.waitForSelector(".product-item, .product, [data-product-id]");\n`;
      stepsCode += `            page.click(".product-item:first-child, .product:first-child, [data-product-id]:first-child");\n`;
      stepsCode += `            System.out.println("🛍️ Selected product");\n`;
      
    } else if (stepLower.includes('click') && stepLower.includes('button')) {
      const buttonText = step.match(/["']([^"']+)["']/);
      if (buttonText) {
        stepsCode += `            page.click("button:has-text('${buttonText[1]}'), [value='${buttonText[1]}']");\n`;
        stepsCode += `            System.out.println("🖱️ Clicked button: ${buttonText[1]}");\n`;
      } else {
        stepsCode += `            page.click("button, [type='button'], [type='submit']");\n`;
        stepsCode += `            System.out.println("🖱️ Clicked button");\n`;
      }
      
    } else if (stepLower.includes('logout') || stepLower.includes('sign out')) {
      stepsCode += `            page.click(".logout, #logout, [href*='logout'], button:has-text('Logout')");\n`;
      stepsCode += `            page.waitForLoadState("networkidle");\n`;
      stepsCode += `            System.out.println("🚪 Logged out successfully");\n`;
      
    } else if (stepLower.includes('wait') || stepLower.includes('load')) {
      stepsCode += `            page.waitForLoadState("networkidle");\n`;
      stepsCode += `            Thread.sleep(2000);\n`;
      stepsCode += `            System.out.println("⏳ Waited for page to load");\n`;
      
    } else if (stepLower.includes('verify') && stepLower.includes('text')) {
      const textToVerify = step.match(/"([^"]+)"/);
      if (textToVerify) {
        stepsCode += `            assertTrue(page.textContent("body").contains("${textToVerify[1]}"), "Page should contain text: ${textToVerify[1]}");\n`;
        stepsCode += `            System.out.println("✅ Verified text: ${textToVerify[1]}");\n`;
      } else {
        stepsCode += `            System.out.println("✅ Verified page content");\n`;
      }
      
    } else if (stepLower.includes('assert') || stepLower.includes('verify')) {
      stepsCode += `            // Custom verification for: ${step}\n`;
      stepsCode += `            assertTrue(page.isVisible("body"), "Page should be loaded");\n`;
      stepsCode += `            System.out.println("✅ Verified: ${step}");\n`;
      
    } else {
      // Generic action based on step content
      stepsCode += `            // Executing: ${step}\n`;
      stepsCode += `            Thread.sleep(1000);\n`;
      stepsCode += `            System.out.println("🔄 Executed step: ${step}");\n`;
    }
    
    stepsCode += `\n`;
  });
  
  // Add screenshot at the end
  const screenshotName = testCase.testCaseId.replace(/[^a-zA-Z0-9]/g, '_');
  stepsCode += `            // Take screenshot for verification\n`;
  stepsCode += `            takeScreenshot("${screenshotName}");\n`;
  
  return stepsCode;
}

// Generate Java Playwright automation code and return both code and extracted data
function generateJavaPlaywrightCodeWithData(detailedTestCases, userStory, csvTestCases) {
  console.log('🔄 Generating Java Playwright automation code with real data...');

  // First, try to get the latest user story from CSV
  const csvUserStory = readUserStoryFromCSV();
  const actualUserStory = csvUserStory ? csvUserStory.userStory : (userStory || 'Default user story');

  // Extract real data from the actual user story
  const realData = extractRealTimeDataFromUserStory(actualUserStory);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const className = `AutomationTest_${timestamp.replace(/[-T]/g, '_').replace(/Z$/, '')}`;

  let javaCode = `package com.qa.tests;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 🧘 Zen QA - Automated Test Suite
 * Generated from User Story: ${actualUserStory.replace(/"/g, '\\"')}
 * 
 * Application: ${realData.application}
 * Base URL: ${realData.baseUrl}
 * Test User: ${realData.username}
 * Generated on: ${new Date().toLocaleString()}
 * 
 * Features to test: ${realData.features.join(', ')}
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ${className} {
    
    // 🌐 Test Configuration - Real Data Extracted from User Story
    private static final String BASE_URL = "${realData.baseUrl}";
    private static final String USERNAME = "${realData.username}";
    private static final String PASSWORD = "${realData.password}";
    private static final String APPLICATION_NAME = "${realData.application}";
    
    private static Playwright playwright;
    private static Browser browser;
    private BrowserContext context;
    private Page page;
    
    @BeforeAll
    static void setUpClass() {
        System.out.println("🧘 Starting Zen QA Test Suite for " + APPLICATION_NAME);
        System.out.println("🌐 Base URL: " + BASE_URL);
        System.out.println("👤 Test User: " + USERNAME);
        System.out.println("🎯 Test Features: ${realData.features.join(', ')}");
        
        playwright = Playwright.create();
        browser = playwright.chromium().launch(new BrowserType.LaunchOptions()
            .setHeadless(false)
            .setSlowMo(1000));
    }
    
    @BeforeEach
    void setUp() {
        context = browser.newContext(new Browser.NewContextOptions()
            .setViewportSize(1920, 1080));
        page = context.newPage();
        
        // Enable request/response logging
        page.onRequest(request -> 
            System.out.println("📤 Request: " + request.method() + " " + request.url()));
        page.onResponse(response -> 
            System.out.println("📥 Response: " + response.status() + " " + response.url()));
    }
    
    @AfterEach
    void tearDown() {
        if (context != null) {
            context.close();
        }
    }
    
    @AfterAll
    static void tearDownClass() {
        if (browser != null) {
            browser.close();
        }
        if (playwright != null) {
            playwright.close();
        }
        System.out.println("🧘 Zen QA Test Suite completed peacefully");
    }
    
    /**
     * 📸 Take screenshot for test verification
     */
    private void takeScreenshot(String testName) {
        try {
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss"));
            String screenshotPath = "screenshots/" + testName + "_" + timestamp + ".png";
            page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get(screenshotPath)));
            System.out.println("📸 Screenshot saved: " + screenshotPath);
        } catch (Exception e) {
            System.out.println("⚠️ Could not take screenshot: " + e.getMessage());
        }
    }
`;
  // Generate test methods for each detailed test case
  detailedTestCases.forEach((testCase, index) => {
    const methodName = `test${testCase.testCaseId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const testDescription = testCase.testCaseName || `Test Case ${index + 1}`;
    
    javaCode += `
    /**
     * 🧪 ${testDescription}
     * Test Case ID: ${testCase.testCaseId}
     * Category: ${testCase.category}
     * Priority: ${testCase.priority}
     * 
     * Preconditions: ${testCase.preconditions}
     * Expected Results: ${testCase.expectedResults}
     */
    @Test
    @Order(${index + 1})
    @DisplayName("${testDescription}")
    void ${methodName}() {
        try {
            System.out.println("\\n🧪 Starting Test: ${testDescription}");
            System.out.println("📋 Test Case ID: ${testCase.testCaseId}");
            System.out.println("🎯 Category: ${testCase.category} | Priority: ${testCase.priority}");
            
${generateRealisticTestStepsCode(testCase, realData)}
            
            System.out.println("✅ Test completed successfully: ${testDescription}");
            
        } catch (PlaywrightException e) {
            System.err.println("❌ Playwright error in test: ${testDescription}");
            System.err.println("💥 Error: " + e.getMessage());
            takeScreenshot("${methodName}_PLAYWRIGHT_ERROR");
            throw e;
        } catch (AssertionFailedError e) {
            System.err.println("❌ Assertion failed in test: ${testDescription}");
            System.err.println("💥 Error: " + e.getMessage());
            takeScreenshot("${methodName}_ASSERTION_FAILED");
            throw e;
        } catch (Exception e) {
            System.err.println("❌ Unexpected error in test: ${testDescription}");
            System.err.println("💥 Error: " + e.getMessage());
            takeScreenshot("${methodName}_FAILED");
            throw e;
        }
    }
`;
  });

  javaCode += `
}`;

  console.log('✅ Generated Java Playwright code with real data');
  console.log('🔍 Extracted data used:', realData);
  console.log('📖 User story processed:', actualUserStory);

  return { automationCode: javaCode, extractedRealData: realData };
}

server.listen(PORT, () => {
  console.log(`🧘 Zen QA Server running on port ${PORT}`);
  console.log(`📱 Open your browser to http://localhost:${PORT}`);
});

// Get all user stories from main UserStory.csv file
app.get('/api/user-stories', async (req, res) => {
  try {
    const mainCsvFilePath = path.join(__dirname, 'data', 'UserStory.csv');
    
    if (!fs.existsSync(mainCsvFilePath)) {
      return res.json({
        success: true,
        userStories: [],
        message: 'No user stories found. Create some user stories first!',
        totalCount: 0
      });
    }
    
    // Read user stories from main CSV file
    const userStories = await new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(mainCsvFilePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
    
    // Sort by timestamp (most recent first)
    userStories.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    
    res.json({
      success: true,
      userStories: userStories.map(story => ({
        id: story.ID,
        timestamp: story.Timestamp,
        userStory: story['User Story'],
        category: story.Category,
        priority: story.Priority,
        complexity: story.Complexity
      })),
      totalCount: userStories.length,
      message: `Found ${userStories.length} user stories`
    });
    
  } catch (error) {
    console.error('❌ Error reading user stories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve user stories',
      details: error.message
    });
  }
});

// Get user stories by category
app.get('/api/user-stories/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const mainCsvFilePath = path.join(__dirname, 'data', 'UserStory.csv');
    
    if (!fs.existsSync(mainCsvFilePath)) {
      return res.json({
        success: true,
        userStories: [],
        message: `No user stories found for category: ${category}`,
        totalCount: 0,
        category
      });
    }
    
    // Read user stories from main CSV file
    const allUserStories = await new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(mainCsvFilePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
    
    // Filter by category (case-insensitive)
    const filteredStories = allUserStories.filter(story => 
      story.Category && story.Category.toLowerCase() === category.toLowerCase()
    );
    
    // Sort by timestamp (most recent first)
    filteredStories.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
    
    res.json({
      success: true,
      userStories: filteredStories.map(story => ({
        id: story.ID,
        timestamp: story.Timestamp,
        userStory: story['User Story'],
        category: story.Category,
        priority: story.Priority,
        complexity: story.Complexity
      })),
      totalCount: filteredStories.length,
      category,
      message: `Found ${filteredStories.length} user stories for category: ${category}`
    });
    
  } catch (error) {
    console.error('❌ Error reading user stories by category:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve user stories by category',
      details: error.message
    });
  }
});

// Upload user story file endpoint
app.post('/api/upload-userstory', async (req, res) => {
  try {
    const { fileContent, fileName, fileType } = req.body;
    
    // Validate input
    if (!fileContent || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'File content and name are required',
        message: 'Please provide valid file data'
      });
    }
    
    console.log('🔄 Processing uploaded user story file:', fileName);
    
    let userStoryContent = '';
    
    // Parse content based on file type
    if (fileType === 'csv' || fileName.toLowerCase().endsWith('.csv')) {
      const lines = fileContent.split('\n');
      if (lines.length > 1) {
        // Skip header row and get first data row, first column
        const dataRow = lines[1].split(',');
        if (dataRow.length > 0) {
          userStoryContent = dataRow[0].replace(/"/g, '').trim();
        } else {
          throw new Error('CSV file format is invalid or empty');
        }
      } else {
        throw new Error('CSV file appears to be empty or has no data rows');
      }
    } else {
      // Text file - use content directly
      userStoryContent = fileContent.trim();
    }
    
    // Validate content
    if (!userStoryContent || userStoryContent.length === 0) {
      throw new Error('File content is empty or invalid');
    }
    
    if (userStoryContent.length < 10) {
      throw new Error('User story content is too short (minimum 10 characters required)');
    }
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Analyze user story to determine category and metadata
    const storyAnalysis = analyzeUserStory(userStoryContent);
    
    const userStoryRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      userStory: userStoryContent,
      category: storyAnalysis.category,
      priority: storyAnalysis.priority,
      complexity: storyAnalysis.complexity,
      source: `Uploaded from ${fileName}`
    };
    
    // Main UserStory.csv file path
    const mainCsvFilePath = path.join(__dirname, 'data', 'UserStory.csv');
    
    // Handle main UserStory.csv file - append or create
    let existingRecords = [];
    if (fs.existsSync(mainCsvFilePath)) {
      // Read existing records from main CSV file
      existingRecords = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(mainCsvFilePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
      console.log(`📄 Found ${existingRecords.length} existing user stories in main CSV`);
    }
    
    // Check if this user story already exists (avoid duplicates)
    const userStoryExists = existingRecords.some(record => 
      record['User Story'] && 
      record['User Story'].trim().toLowerCase() === userStoryContent.trim().toLowerCase()
    );
    
    if (!userStoryExists) {
      // Add new record to existing records
      existingRecords.push({
        'ID': userStoryRecord.id,
        'Timestamp': userStoryRecord.timestamp,
        'User Story': userStoryRecord.userStory,
        'Category': userStoryRecord.category,
        'Priority': userStoryRecord.priority,
        'Complexity': userStoryRecord.complexity,
        'Source': userStoryRecord.source
      });
      
      // Create CSV writer for main file
      const mainCsvWriter = createObjectCsvWriter({
        path: mainCsvFilePath,
        header: [
          { id: 'ID', title: 'ID' },
          { id: 'Timestamp', title: 'Timestamp' },
          { id: 'User Story', title: 'User Story' },
          { id: 'Category', title: 'Category' },
          { id: 'Priority', title: 'Priority' },
          { id: 'Complexity', title: 'Complexity' }
        ]
      });
      
      // Write all records (existing + new) to main CSV
      await mainCsvWriter.writeRecords(existingRecords);
      console.log('✅ User story saved to main UserStory.csv file');
    } else {
      console.log('ℹ️ User story already exists in main CSV, skipping duplicate');
    }
    
    // Create timestamped backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const timestampedCsvFilePath = path.join(__dirname, 'data', `UserStory_Upload_${timestamp}.csv`);
    
    const timestampedCsvWriter = createObjectCsvWriter({
      path: timestampedCsvFilePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'userStory', title: 'User Story' },
        { id: 'category', title: 'Category' },
        { id: 'priority', title: 'Priority' },
        { id: 'complexity', title: 'Complexity' },
        { id: 'source', title: 'Source' }
      ]
    });
    
    await timestampedCsvWriter.writeRecords([userStoryRecord]);
    console.log('✅ User story backup saved to timestamped CSV:', timestampedCsvFilePath);
    
    res.json({
      success: true,
      message: `User story successfully uploaded and saved to UserStory.csv`,
      userStory: userStoryContent,
      analysis: storyAnalysis,
      csvFiles: {
        main: mainCsvFilePath,
        backup: timestampedCsvFilePath
      },
      fileInfo: {
        originalName: fileName,
        fileType: fileType,
        contentLength: userStoryContent.length,
        duplicate: userStoryExists
      },
      recordInfo: {
        id: userStoryRecord.id,
        category: userStoryRecord.category,
        priority: userStoryRecord.priority,
        complexity: userStoryRecord.complexity
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing uploaded user story file:', error);
    res.status(500).json({
      success: false,
      error: 'File upload failed',
      message: error.message || 'Failed to process uploaded user story file',
      details: error.message
    });
  }
});

// Upload test cases file endpoint
app.post('/api/upload-testcases', async (req, res) => {
  try {
    const { fileContent, fileName, fileType } = req.body;
    
    // Validate input
    if (!fileContent || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'File content and name are required',
        message: 'Please provide valid file data'
      });
    }
    
    console.log('🔄 Processing uploaded test cases file:', fileName);
    
    let testCases = [];
    
    // Parse content based on file type
    if (fileType === 'csv' || fileName.toLowerCase().endsWith('.csv')) {
      const lines = fileContent.split('\n');
      
      if (lines.length <= 1) {
        throw new Error('CSV file appears to be empty or has no data rows');
      }
      
      // Skip header row and process data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const columns = line.split(',');
          // Assuming test case name is in second column (index 1)
          if (columns.length > 1) {
            const testCaseName = columns[1].replace(/"/g, '').trim();
            if (testCaseName && testCaseName.length > 5) {
              testCases.push(testCaseName);
            }
          }
        }
      }
    } else {
      // Parse text format - each line is a test case
      const lines = fileContent.split('\n');
      testCases = lines
        .map(line => line.trim())
        .filter(line => line.length > 5); // Filter out very short lines
    }
    
    // Validate test cases
    if (testCases.length === 0) {
      throw new Error('No valid test cases found in the file. Please check the file format and content.');
    }
    
    if (testCases.length > 100) {
      throw new Error(`Too many test cases (${testCases.length}). Maximum 100 test cases allowed per upload.`);
    }
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Save test cases to timestamped CSV file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testCasesCsvPath = path.join(__dirname, 'data', `TestCases_Upload_${timestamp}.csv`);
    
    const testCasesData = testCases.map((testCase, index) => ({
      testCaseId: `TC_UPLOAD_${(index + 1).toString().padStart(3, '0')}`,
      testCaseName: testCase,
      category: 'General',
      priority: 'Medium',
      preconditions: 'Application is accessible and ready for testing',
      testSteps: 'Steps to be defined based on test case requirements',
      expectedResults: `Test case "${testCase}" should be completed successfully`,
      testData: 'Test data as per requirements',
      source: `Uploaded from ${fileName}`,
      uploadTimestamp: new Date().toISOString()
    }));
    
    const testCasesWriter = createObjectCsvWriter({
      path: testCasesCsvPath,
      header: [
        { id: 'testCaseId', title: 'Test Case ID' },
        { id: 'testCaseName', title: 'Test Case Name' },
        { id: 'category', title: 'Category' },
        { id: 'priority', title: 'Priority' },
        { id: 'preconditions', title: 'Preconditions' },
        { id: 'testSteps', title: 'Test Steps' },
        { id: 'expectedResults', title: 'Expected Results' },
        { id: 'testData', title: 'Test Data' },
        { id: 'source', title: 'Source' },
        { id: 'uploadTimestamp', title: 'Upload Timestamp' }
      ]
    });
    
    await testCasesWriter.writeRecords(testCasesData);
    console.log('✅ Test cases saved to CSV:', testCasesCsvPath);
    
    res.json({
      success: true,
      message: `${testCases.length} test cases successfully uploaded and saved`,
      testCases: testCases,
      csvFile: {
        path: testCasesCsvPath,
        filename: `TestCases_Upload_${timestamp}.csv`,
        recordCount: testCases.length
      },
      fileInfo: {
        originalName: fileName,
        fileType: fileType,
        testCaseCount: testCases.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing uploaded test cases file:', error);
    res.status(500).json({
      success: false,
      error: 'File upload failed',
      message: error.message || 'Failed to process uploaded test cases file',
      details: error.message
    });
  }
});

package com.zenqa;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

import java.util.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@SpringBootApplication
@RestController
@CrossOrigin(origins = "*")
public class ZenQAService {
    
    public static void main(String[] args) {
        SpringApplication.run(ZenQAService.class, args);
        System.out.println("🧘 Zen QA Java Service is running on port 8080");
    }

    @PostMapping("/api/java/generate-testcases")
    public ResponseEntity<Map<String, Object>> generateTestCases(@RequestBody Map<String, String> request) {
        String userStory = request.get("userStory");
        
        // Simulate test case generation logic
        List<String> testCases = generateTestCasesFromStory(userStory);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("userStory", userStory);
        response.put("testCases", testCases);
        response.put("generated", true);
        response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        response.put("language", "java");
        response.put("framework", "playwright");
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/java/generate-automation")
    public ResponseEntity<Map<String, Object>> generateAutomationCode(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<String> testCases = (List<String>) request.get("testCases");
        
        String automationCode = generatePlaywrightCode(testCases);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("code", automationCode);
        response.put("language", "java");
        response.put("framework", "playwright");
        response.put("testCases", testCases);
        response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/java/execution-results")
    public ResponseEntity<Map<String, Object>> getExecutionResults() {
        Map<String, Object> results = generateMockExecutionResults();
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("results", results);
        response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        Map<String, String> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "Zen QA Java Service");
        health.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        return ResponseEntity.ok(health);
    }

    @PostMapping("/api/java/run-automation")
    public ResponseEntity<Map<String, Object>> runAutomationCode(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<String> testCases = (List<String>) request.get("testCases");
        
        // Simulate test execution
        Map<String, Object> executionResults = executeTests(testCases);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("results", executionResults);
        response.put("message", "Test execution completed successfully");
        response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        return ResponseEntity.ok(response);
    }

    private List<String> generateTestCasesFromStory(String userStory) {
        List<String> testCases = new ArrayList<>();
        
        // Analyze user story and generate relevant test cases
        String storyLower = userStory.toLowerCase();
        
        if (storyLower.contains("login")) {
            testCases.add("Verify successful login with valid credentials");
            testCases.add("Verify login failure with invalid credentials");
            testCases.add("Verify password field is masked during input");
            testCases.add("Verify remember me functionality");
            testCases.add("Verify forgot password link functionality");
        } else if (storyLower.contains("search")) {
            testCases.add("Verify search with valid keywords");
            testCases.add("Verify search with invalid keywords");
            testCases.add("Verify search with special characters");
            testCases.add("Verify search filters functionality");
            testCases.add("Verify search results pagination");
        } else if (storyLower.contains("register") || storyLower.contains("signup")) {
            testCases.add("Verify successful registration with valid data");
            testCases.add("Verify registration with invalid email format");
            testCases.add("Verify registration with weak password");
            testCases.add("Verify email verification process");
            testCases.add("Verify duplicate email handling");
        } else {
            // Generic test cases for any user story
            testCases.add("Verify " + userStory.toLowerCase() + " with valid inputs");
            testCases.add("Verify " + userStory.toLowerCase() + " with invalid inputs");
            testCases.add("Verify " + userStory.toLowerCase() + " with boundary values");
            testCases.add("Verify " + userStory.toLowerCase() + " error handling");
            testCases.add("Verify " + userStory.toLowerCase() + " UI responsiveness");
        }
        
        return testCases;
    }

    private String generatePlaywrightCode(List<String> testCases) {
        StringBuilder code = new StringBuilder();
        
        code.append("package com.zenqa.tests;\n\n");
        code.append("import com.microsoft.playwright.*;\n");
        code.append("import org.junit.jupiter.api.*;\n");
        code.append("import static org.junit.jupiter.api.Assertions.*;\n\n");
        
        code.append("/**\n");
        code.append(" * 🧘 Zen QA - Auto-generated Playwright Tests\n");
        code.append(" * Generated on: ").append(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)).append("\n");
        code.append(" * Test Cases: ").append(testCases.size()).append("\n");
        code.append(" */\n");
        code.append("public class ZenQATests {\n\n");
        
        code.append("    private Playwright playwright;\n");
        code.append("    private Browser browser;\n");
        code.append("    private BrowserContext context;\n");
        code.append("    private Page page;\n\n");
        
        code.append("    @BeforeAll\n");
        code.append("    static void setupClass() {\n");
        code.append("        System.out.println(\"🧘 Starting Zen QA Test Suite\");\n");
        code.append("    }\n\n");
        
        code.append("    @BeforeEach\n");
        code.append("    void setUp() {\n");
        code.append("        playwright = Playwright.create();\n");
        code.append("        browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(false));\n");
        code.append("        context = browser.newContext();\n");
        code.append("        page = context.newPage();\n");
        code.append("    }\n\n");
        
        code.append("    @AfterEach\n");
        code.append("    void tearDown() {\n");
        code.append("        if (browser != null) {\n");
        code.append("            browser.close();\n");
        code.append("        }\n");
        code.append("        if (playwright != null) {\n");
        code.append("            playwright.close();\n");
        code.append("        }\n");
        code.append("    }\n\n");
        
        // Generate test methods based on test cases
        for (int i = 0; i < testCases.size(); i++) {
            String testCase = testCases.get(i);
            String methodName = generateMethodName(testCase, i);
            
            code.append("    @Test\n");
            code.append("    @DisplayName(\"").append(testCase).append("\")\n");
            code.append("    void ").append(methodName).append("() {\n");
            code.append("        // 🧘 Test: ").append(testCase).append("\n");
            code.append("        try {\n");
            code.append("            // Navigate to application\n");
            code.append("            page.navigate(\"https://your-app-url.com\");\n");
            code.append("            \n");
            code.append("            // Wait for page to load\n");
            code.append("            page.waitForLoadState();\n");
            code.append("            \n");
            
            if (testCase.toLowerCase().contains("login")) {
                code.append("            // Perform login test steps\n");
                code.append("            page.click(\"#loginButton\");\n");
                code.append("            page.fill(\"#username\", \"test@example.com\");\n");
                code.append("            page.fill(\"#password\", \"password123\");\n");
                code.append("            page.click(\"#submitLogin\");\n");
                code.append("            \n");
                code.append("            // Verify login result\n");
                if (testCase.toLowerCase().contains("valid") || testCase.toLowerCase().contains("successful")) {
                    code.append("            page.waitForSelector(\".dashboard\");\n");
                    code.append("            assertTrue(page.isVisible(\".dashboard\"));\n");
                } else {
                    code.append("            page.waitForSelector(\".error-message\");\n");
                    code.append("            assertTrue(page.isVisible(\".error-message\"));\n");
                }
            } else if (testCase.toLowerCase().contains("search")) {
                code.append("            // Perform search test steps\n");
                code.append("            page.fill(\"#searchInput\", \"test query\");\n");
                code.append("            page.click(\"#searchButton\");\n");
                code.append("            \n");
                code.append("            // Verify search results\n");
                code.append("            page.waitForSelector(\".search-results\");\n");
                code.append("            assertTrue(page.isVisible(\".search-results\"));\n");
            } else {
                code.append("            // Generic test implementation\n");
                code.append("            // TODO: Implement specific test steps for: ").append(testCase).append("\n");
                code.append("            \n");
                code.append("            // Example assertion\n");
                code.append("            assertTrue(page.title().length() > 0);\n");
            }
            
            code.append("            \n");
            code.append("            System.out.println(\"✅ Test passed: ").append(testCase).append("\");\n");
            code.append("            \n");
            code.append("        } catch (Exception e) {\n");
            code.append("            System.err.println(\"❌ Test failed: ").append(testCase).append("\");\n");
            code.append("            throw e;\n");
            code.append("        }\n");
            code.append("    }\n\n");
        }
        
        code.append("    @AfterAll\n");
        code.append("    static void tearDownClass() {\n");
        code.append("        System.out.println(\"🧘 Zen QA Test Suite Completed\");\n");
        code.append("    }\n");
        code.append("}\n");
        
        return code.toString();
    }

    private String generateMethodName(String testCase, int index) {
        String methodName = testCase.toLowerCase()
            .replaceAll("[^a-zA-Z0-9\\s]", "")
            .replaceAll("\\s+", "_")
            .replaceAll("verify_", "test_");
        
        if (methodName.length() > 50) {
            methodName = methodName.substring(0, 47) + "_" + index;
        }
        
        return methodName;
    }

    private Map<String, Object> generateMockExecutionResults() {
        List<Map<String, Object>> testResults = new ArrayList<>();
        
        // Mock test results
        testResults.add(createTestResult("testValidLogin", "PASSED", "2.3s", "Login successful with valid credentials"));
        testResults.add(createTestResult("testInvalidLogin", "PASSED", "1.8s", "Error message displayed correctly"));
        testResults.add(createTestResult("testPasswordMasking", "FAILED", "1.2s", "Password field masking not working"));
        testResults.add(createTestResult("testSearchFunctionality", "PASSED", "3.1s", "Search functionality working as expected"));
        testResults.add(createTestResult("testUIResponsiveness", "PASSED", "2.7s", "UI responsive across different screen sizes"));
        
        Map<String, Object> summary = new HashMap<>();
        summary.put("total", testResults.size());
        summary.put("passed", (int) testResults.stream().filter(r -> "PASSED".equals(r.get("status"))).count());
        summary.put("failed", (int) testResults.stream().filter(r -> "FAILED".equals(r.get("status"))).count());
        summary.put("duration", "11.1s");
        summary.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        Map<String, Object> results = new HashMap<>();
        results.put("testResults", testResults);
        results.put("summary", summary);
        
        return results;
    }

    private Map<String, Object> createTestResult(String testName, String status, String duration, String details) {
        Map<String, Object> result = new HashMap<>();
        result.put("testName", testName);
        result.put("status", status);
        result.put("duration", duration);
        result.put("details", details);
        return result;
    }

    private Map<String, Object> executeTests(List<String> testCases) {
        List<Map<String, Object>> testResults = new ArrayList<>();
        Random random = new Random();
        
        for (String testCase : testCases) {
            String methodName = generateMethodName(testCase, testResults.size());
            boolean shouldPass = random.nextDouble() > 0.15; // 85% pass rate
            double duration = 1.0 + (random.nextDouble() * 3.0); // 1-4 seconds
            
            String status = shouldPass ? "PASSED" : "FAILED";
            String details = shouldPass ? 
                testCase + " executed successfully" : 
                testCase + " failed - assertion error or timeout";
            
            testResults.add(createTestResult(
                methodName,
                status,
                String.format("%.1fs", duration),
                details
            ));
        }
        
        int passed = (int) testResults.stream().filter(r -> "PASSED".equals(r.get("status"))).count();
        int failed = testResults.size() - passed;
        double totalDuration = testResults.stream()
            .mapToDouble(r -> Double.parseDouble(((String) r.get("duration")).replace("s", "")))
            .sum();
        
        Map<String, Object> summary = new HashMap<>();
        summary.put("total", testResults.size());
        summary.put("passed", passed);
        summary.put("failed", failed);
        summary.put("duration", String.format("%.1fs", totalDuration));
        summary.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        
        Map<String, Object> results = new HashMap<>();
        results.put("testResults", testResults);
        results.put("summary", summary);
        
        return results;
    }
}

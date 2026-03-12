/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export async function getPromptForAddingProfilerSupport(connectionString: string): Promise<string> {
    let prompt = `You are a software engineer tasked with integrating the Azure Monitor OpenTelemetry Profiler into an ASP.NET Core application. The profiler will help in monitoring and diagnosing performance issues in the application.\n\n`;
    prompt += `You are not supposed to change any other parts of the application, only to add the OpenTelemetry Profiler.\n\n`;
    prompt += `Read this instruction carefully and follow the steps to ensure a successful integration.\n\n`;
    prompt += `Ask for the necessary information to complete the integration, such as:\n`;
    prompt += `- Which project to integrate the profiler into (if there are multiple projects).\n\n`;
    prompt += `Here are the steps you need to follow:\n\n`;
    prompt += `1. **Identify the Project**: Determine which ASP.NET Core project you need to integrate the OpenTelemetry Profiler into. If there are multiple projects, ask for the specific one.\n`;
    prompt += `2. **Add the latest required NuGet packages**, including the prerelease versions if necessary:\n`;
    prompt += `   - Azure.Monitor.OpenTelemetry.AspNetCore\n`;
    prompt += `   - Azure.Monitor.OpenTelemetry.Profiler\n`;
    prompt += `   Do not install any other packages or change existing ones.\n\n`;
    prompt += `3. Append the call to AddAzureMonitorProfiler() in the code. For example\n\n`;
    prompt += `\`\`\`csharp\n`;
    prompt += `using Azure.Monitor.OpenTelemetry.AspNetCore;\n`;
    prompt += `// Import the Azure.Monitor.OpenTelemetry.Profiler namespace.\n`;
    prompt += `using Azure.Monitor.OpenTelemetry.Profiler;\n\n`;
    prompt += `// ...\n`;
    prompt += `builder.Services.AddOpenTelemetry()\n`;
    prompt += `      .UseAzureMonitor()\n`;
    prompt += `      .AddAzureMonitorProfiler();  // Add Azure Monitor Profiler\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `4. Add the connection string ${connectionString} for the Azure Monitor OpenTelemetry distro, so that the profiler can send data to Azure Monitor.\n`;

    return prompt;
}

import http from "http";
import { parseStringPromise, Builder } from "xml2js";
import { storage } from "../storage";
import type { Tr069Device, InsertTr069Device } from "@shared/schema";

const ACS_PORT = 7547;
const ACS_USERNAME = process.env.ACS_USERNAME || "admin";
const ACS_PASSWORD = process.env.ACS_PASSWORD || "admin";

interface InformRequest {
  DeviceId: {
    Manufacturer: string;
    OUI: string;
    ProductClass: string;
    SerialNumber: string;
  };
  Event: Array<{ EventCode: string; CommandKey?: string }>;
  MaxEnvelopes: number;
  CurrentTime: string;
  RetryCount: number;
  ParameterList: Array<{ Name: string; Value: string }>;
}

interface RpcRequest {
  methodName: string;
  cwmpId: string;
  body: any;
}

export function createAcsServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, SOAPAction",
      });
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    const authHeader = req.headers.authorization;
    if (authHeader) {
      const base64Credentials = authHeader.split(" ")[1];
      const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
      const [username, password] = credentials.split(":");
      if (username !== ACS_USERNAME || password !== ACS_PASSWORD) {
        res.writeHead(401, { "WWW-Authenticate": 'Basic realm="ACS"' });
        res.end("Unauthorized");
        return;
      }
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        if (!body.trim()) {
          res.writeHead(204);
          res.end();
          return;
        }

        const response = await handleSoapRequest(body);
        res.writeHead(200, {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": "",
        });
        res.end(response);
      } catch (error) {
        console.error("ACS Error:", error);
        res.writeHead(500, { "Content-Type": "text/xml" });
        res.end(buildSoapFault("Server Error", String(error)));
      }
    });
  });

  server.listen(ACS_PORT, "0.0.0.0", () => {
    console.log(`TR-069 ACS Server running on port ${ACS_PORT}`);
  });

  return server;
}

async function handleSoapRequest(xml: string): Promise<string> {
  const parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
  
  const envelope = parsed["soap-env:Envelope"] || parsed["SOAP-ENV:Envelope"] || parsed["soapenv:Envelope"];
  if (!envelope) {
    throw new Error("Invalid SOAP envelope");
  }

  const body = envelope["soap-env:Body"] || envelope["SOAP-ENV:Body"] || envelope["soapenv:Body"];
  if (!body) {
    throw new Error("Invalid SOAP body");
  }

  const rpc = extractRpcMethod(body);
  
  switch (rpc.methodName) {
    case "Inform":
      return handleInform(rpc.body, rpc.cwmpId);
    case "TransferComplete":
      return handleTransferComplete(rpc.body, rpc.cwmpId);
    case "GetRPCMethodsResponse":
      return handleGetRPCMethodsResponse(rpc.body, rpc.cwmpId);
    case "GetParameterValuesResponse":
      return handleGetParameterValuesResponse(rpc.body, rpc.cwmpId);
    case "SetParameterValuesResponse":
      return handleSetParameterValuesResponse(rpc.body, rpc.cwmpId);
    case "DownloadResponse":
      return handleDownloadResponse(rpc.body, rpc.cwmpId);
    case "RebootResponse":
      return handleRebootResponse(rpc.body, rpc.cwmpId);
    case "FactoryResetResponse":
      return handleFactoryResetResponse(rpc.body, rpc.cwmpId);
    default:
      console.log(`Unknown RPC method: ${rpc.methodName}`);
      return buildEmptyResponse(rpc.cwmpId);
  }
}

function extractRpcMethod(body: any): RpcRequest {
  const cwmpNs = ["cwmp:", "urn:dslforum-org:cwmp-1-0:", ""];
  
  for (const ns of cwmpNs) {
    for (const key of Object.keys(body)) {
      const methodName = key.replace(ns, "").replace("cwmp:", "");
      if (methodName && methodName !== "Header") {
        return {
          methodName,
          cwmpId: extractCwmpId(body) || generateCwmpId(),
          body: body[key],
        };
      }
    }
  }
  
  return { methodName: "Unknown", cwmpId: generateCwmpId(), body: {} };
}

function extractCwmpId(body: any): string | null {
  return null;
}

function generateCwmpId(): string {
  return `cwmp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function handleInform(inform: any, cwmpId: string): Promise<string> {
  console.log("Received Inform from device");
  
  const deviceId = inform.DeviceId || {};
  const oui = deviceId.OUI?._ || deviceId.OUI || "";
  const productClass = deviceId.ProductClass?._ || deviceId.ProductClass || "";
  const serialNumber = deviceId.SerialNumber?._ || deviceId.SerialNumber || "";
  const manufacturer = deviceId.Manufacturer?._ || deviceId.Manufacturer || "";
  
  const uniqueDeviceId = `${oui}-${productClass}-${serialNumber}`;
  
  const parameterList = inform.ParameterList?.ParameterValueStruct || [];
  const parameters: Record<string, string> = {};
  
  if (Array.isArray(parameterList)) {
    parameterList.forEach((param: any) => {
      const name = param.Name?._ || param.Name || "";
      const value = param.Value?._ || param.Value || "";
      parameters[name] = value;
    });
  }

  const softwareVersion = parameters["InternetGatewayDevice.DeviceInfo.SoftwareVersion"] || 
                          parameters["Device.DeviceInfo.SoftwareVersion"] || "";
  const hardwareVersion = parameters["InternetGatewayDevice.DeviceInfo.HardwareVersion"] || 
                          parameters["Device.DeviceInfo.HardwareVersion"] || "";
  const connectionRequestUrl = parameters["InternetGatewayDevice.ManagementServer.ConnectionRequestURL"] || 
                               parameters["Device.ManagementServer.ConnectionRequestURL"] || "";
  const externalIp = parameters["InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress"] ||
                     parameters["Device.IP.Interface.1.IPv4Address.1.IPAddress"] || "";

  try {
    let device = await storage.getTr069DeviceByDeviceId(uniqueDeviceId);
    
    if (device) {
      device = await storage.updateTr069Device(device.id, {
        manufacturer,
        modelName: productClass,
        softwareVersion,
        hardwareVersion,
        connectionRequestUrl,
        externalIp,
        lastInformTime: new Date(),
        lastConnectionTime: new Date(),
        isOnline: true,
        parameterCache: parameters,
      });
    } else {
      const tenants = await storage.getTenants();
      const tenantId = tenants.length > 0 ? tenants[0].id : null;
      
      if (tenantId) {
        device = await storage.createTr069Device({
          tenantId,
          deviceId: uniqueDeviceId,
          oui,
          productClass,
          serialNumber,
          manufacturer,
          modelName: productClass,
          softwareVersion,
          hardwareVersion,
          connectionRequestUrl,
          externalIp,
          isOnline: true,
          parameterCache: parameters,
        });
      }
    }

    if (device) {
      const pendingTasks = await storage.getPendingTr069Tasks(device.id);
      if (pendingTasks.length > 0) {
        const task = pendingTasks[0];
        await storage.updateTr069Task(task.id, { status: "in_progress", startedAt: new Date() });
        return buildTaskResponse(task, cwmpId);
      }
    }
  } catch (error) {
    console.error("Error processing Inform:", error);
  }

  return buildInformResponse(cwmpId);
}

function buildInformResponse(cwmpId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/" 
                   xmlns:soap-enc="http://schemas.xmlsoap.org/soap/encoding/"
                   xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap-env:Header>
    <cwmp:ID soap-env:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap-env:Header>
  <soap-env:Body>
    <cwmp:InformResponse>
      <MaxEnvelopes>1</MaxEnvelopes>
    </cwmp:InformResponse>
  </soap-env:Body>
</soap-env:Envelope>`;
}

function buildTaskResponse(task: any, cwmpId: string): string {
  const params = task.parameters as any || {};
  
  switch (task.taskType) {
    case "get_parameter_values":
      return buildGetParameterValues(params.parameterNames || [], cwmpId);
    case "set_parameter_values":
      return buildSetParameterValues(params.parameterValues || [], cwmpId);
    case "download":
      return buildDownload(params, cwmpId);
    case "reboot":
      return buildReboot(cwmpId);
    case "factory_reset":
      return buildFactoryReset(cwmpId);
    default:
      return buildEmptyResponse(cwmpId);
  }
}

function buildGetParameterValues(parameterNames: string[], cwmpId: string): string {
  const parameterNamesXml = parameterNames
    .map((name) => `<string>${name}</string>`)
    .join("\n        ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap-env:Header>
    <cwmp:ID soap-env:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap-env:Header>
  <soap-env:Body>
    <cwmp:GetParameterValues>
      <ParameterNames soap-enc:arrayType="xsd:string[${parameterNames.length}]">
        ${parameterNamesXml}
      </ParameterNames>
    </cwmp:GetParameterValues>
  </soap-env:Body>
</soap-env:Envelope>`;
}

function buildSetParameterValues(parameterValues: Array<{ name: string; value: string; type?: string }>, cwmpId: string): string {
  const parameterValuesXml = parameterValues
    .map((pv) => `
        <ParameterValueStruct>
          <Name>${pv.name}</Name>
          <Value xsi:type="${pv.type || "xsd:string"}">${pv.value}</Value>
        </ParameterValueStruct>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:cwmp="urn:dslforum-org:cwmp-1-0"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap-env:Header>
    <cwmp:ID soap-env:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap-env:Header>
  <soap-env:Body>
    <cwmp:SetParameterValues>
      <ParameterList soap-enc:arrayType="cwmp:ParameterValueStruct[${parameterValues.length}]">${parameterValuesXml}
      </ParameterList>
      <ParameterKey>${Date.now()}</ParameterKey>
    </cwmp:SetParameterValues>
  </soap-env:Body>
</soap-env:Envelope>`;
}

function buildDownload(params: { fileType: string; url: string; username?: string; password?: string; fileSize?: number }, cwmpId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap-env:Header>
    <cwmp:ID soap-env:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap-env:Header>
  <soap-env:Body>
    <cwmp:Download>
      <CommandKey>${Date.now()}</CommandKey>
      <FileType>${params.fileType || "1 Firmware Upgrade Image"}</FileType>
      <URL>${params.url}</URL>
      <Username>${params.username || ""}</Username>
      <Password>${params.password || ""}</Password>
      <FileSize>${params.fileSize || 0}</FileSize>
      <TargetFileName></TargetFileName>
      <DelaySeconds>0</DelaySeconds>
      <SuccessURL></SuccessURL>
      <FailureURL></FailureURL>
    </cwmp:Download>
  </soap-env:Body>
</soap-env:Envelope>`;
}

function buildReboot(cwmpId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap-env:Header>
    <cwmp:ID soap-env:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap-env:Header>
  <soap-env:Body>
    <cwmp:Reboot>
      <CommandKey>${Date.now()}</CommandKey>
    </cwmp:Reboot>
  </soap-env:Body>
</soap-env:Envelope>`;
}

function buildFactoryReset(cwmpId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap-env:Header>
    <cwmp:ID soap-env:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap-env:Header>
  <soap-env:Body>
    <cwmp:FactoryReset>
    </cwmp:FactoryReset>
  </soap-env:Body>
</soap-env:Envelope>`;
}

function buildEmptyResponse(cwmpId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap-env:Header>
    <cwmp:ID soap-env:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap-env:Header>
  <soap-env:Body>
  </soap-env:Body>
</soap-env:Envelope>`;
}

function buildSoapFault(faultCode: string, faultString: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
  <soap-env:Body>
    <soap-env:Fault>
      <faultcode>${faultCode}</faultcode>
      <faultstring>${faultString}</faultstring>
    </soap-env:Fault>
  </soap-env:Body>
</soap-env:Envelope>`;
}

async function handleTransferComplete(body: any, cwmpId: string): Promise<string> {
  console.log("TransferComplete received");
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
  <soap-env:Header>
    <cwmp:ID soap-env:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap-env:Header>
  <soap-env:Body>
    <cwmp:TransferCompleteResponse>
    </cwmp:TransferCompleteResponse>
  </soap-env:Body>
</soap-env:Envelope>`;
}

async function handleGetRPCMethodsResponse(body: any, cwmpId: string): Promise<string> {
  return buildEmptyResponse(cwmpId);
}

async function handleGetParameterValuesResponse(body: any, cwmpId: string): Promise<string> {
  console.log("GetParameterValuesResponse received");
  return buildEmptyResponse(cwmpId);
}

async function handleSetParameterValuesResponse(body: any, cwmpId: string): Promise<string> {
  console.log("SetParameterValuesResponse received");
  return buildEmptyResponse(cwmpId);
}

async function handleDownloadResponse(body: any, cwmpId: string): Promise<string> {
  console.log("DownloadResponse received");
  return buildEmptyResponse(cwmpId);
}

async function handleRebootResponse(body: any, cwmpId: string): Promise<string> {
  console.log("RebootResponse received");
  return buildEmptyResponse(cwmpId);
}

async function handleFactoryResetResponse(body: any, cwmpId: string): Promise<string> {
  console.log("FactoryResetResponse received");
  return buildEmptyResponse(cwmpId);
}

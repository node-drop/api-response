const ApiResponseNode = {
  identifier: "apiResponse",
  displayName: "API Response",
  name: "apiResponse",
  group: ["output"],
  version: 1,
  description: "Smart REST API response with auto-detection of data format (Laravel-style)",
  icon: "file:icon.svg",
  color: "#10B981",
  defaults: {
    name: "API Response",
  },
  inputs: ["main"],
  outputs: [],
  properties: [
    {
      displayName: "Status Code",
      name: "statusCode",
      type: "options",
      default: "auto",
      description: "HTTP status code (auto-detects based on data)",
      options: [
        { name: "Auto", value: "auto" },
        { name: "200 OK", value: 200 },
        { name: "201 Created", value: 201 },
        { name: "204 No Content", value: 204 },
        { name: "400 Bad Request", value: 400 },
        { name: "401 Unauthorized", value: 401 },
        { name: "404 Not Found", value: 404 },
        { name: "422 Validation Error", value: 422 },
        { name: "500 Server Error", value: 500 },
      ],
    },
    {
      displayName: "Custom Message",
      name: "customMessage",
      type: "string",
      default: "",
      description: "Custom message (auto-generated if empty)",
      placeholder: "Data retrieved successfully",
    },
    {
      displayName: "Options",
      name: "options",
      type: "collection",
      placeholder: "Add Option",
      default: {},
      description: "Additional response configuration options",
      options: [
        {
          name: "dataProperty",
          displayName: "Data Property",
          type: "string",
          default: "",
          description: "Property containing the data (leave empty for auto-detect: rows, data, items, result)",
          placeholder: "rows",
        },
        {
          name: "fieldsToInclude",
          displayName: "Fields to Include",
          type: "string",
          default: "",
          description: "Comma-separated fields to include (leave empty for all)",
          placeholder: "id,name,email",
        },
        {
          name: "fieldsToExclude",
          displayName: "Fields to Exclude",
          type: "string",
          default: "password,resetToken,resetTokenExpiry",
          description: "Comma-separated fields to exclude (security)",
          placeholder: "password,token,secret",
        },
        {
          name: "wrapResponse",
          displayName: "Wrap Response",
          type: "boolean",
          default: true,
          description: "Wrap response in standard format {success, data, message}",
        },
        {
          name: "errorMessageField",
          displayName: "Error Message Field",
          type: "string",
          default: "errors,error,_errorMessage,message",
          description: "Comma-separated field names to check for error messages",
          placeholder: "errors,error,message",
        },
        {
          name: "includeDataInError",
          displayName: "Include Data in Error Response",
          type: "boolean",
          default: false,
          description: "Include original data in error responses (useful for debugging)",
        },
        {
          name: "enableCors",
          displayName: "Enable CORS",
          type: "boolean",
          default: true,
          description: "Enable CORS headers for cross-origin requests",
        },
        {
          name: "returnSingleObject",
          displayName: "Return Single Object",
          type: "options",
          default: "auto",
          description: "How to handle single-item arrays",
          options: [
            { name: "Auto (unwrap if 1 item)", value: "auto" },
            { name: "Always Array", value: "array" },
            { name: "Always Object", value: "object" },
          ],
        },
        {
          name: "paginationFormat",
          displayName: "Pagination Format",
          type: "options",
          default: "simple",
          description: "Format for pagination metadata",
          options: [
            { name: "Simple (count/total)", value: "simple" },
            { name: "Laravel (meta/links)", value: "laravel" },
            { name: "None", value: "none" },
          ],
        },
      ],
    },
  ],

  execute: async function (inputData) {
    let items = [];
    if (inputData?.main?.[0]) {
      items = Array.isArray(inputData.main[0]) ? inputData.main[0] : [inputData.main[0]];
    }

    if (items.length === 0) {
      return this.sendResponse(404, { success: false, message: "No data found" });
    }

    const item = items[0].json;

    // Get configuration
    let statusCode = await this.getNodeParameter("statusCode");
    const customMessage = await this.getNodeParameter("customMessage");
    const options = await this.getNodeParameter("options") || {};
    
    // Extract options with defaults
    const dataProperty = options.dataProperty || "";
    const fieldsToInclude = options.fieldsToInclude || "";
    const fieldsToExclude = options.fieldsToExclude || "password,resetToken,resetTokenExpiry";
    const wrapResponse = options.wrapResponse !== undefined ? options.wrapResponse : true;
    const returnSingleObject = options.returnSingleObject || "auto";
    const errorMessageField = options.errorMessageField || "errors,error,_errorMessage,message";
    const includeDataInError = options.includeDataInError || false;
    const enableCors = options.enableCors !== undefined ? options.enableCors : true;
    const paginationFormat = options.paginationFormat || "simple";
    
    // Parse error message fields
    const errorFields = errorMessageField 
      ? errorMessageField.split(',').map(f => f.trim()).filter(f => f)
      : ['errors', 'error', '_errorMessage', 'message'];

    // Helper function to filter fields
    const filterFields = (data, includeStr, excludeStr) => {
      const include = includeStr ? includeStr.split(",").map(f => f.trim()).filter(f => f) : [];
      const exclude = excludeStr ? excludeStr.split(",").map(f => f.trim()).filter(f => f) : [];

      if (include.length === 0 && exclude.length === 0) {
        return data;
      }

      const filterObject = (obj) => {
        if (!obj || typeof obj !== "object" || obj instanceof Date) return obj;
        
        const filtered = {};
        const keys = include.length > 0 ? include : Object.keys(obj);
        
        for (const key of keys) {
          if (exclude.includes(key)) continue;
          if (obj[key] !== undefined) {
            filtered[key] = obj[key];
          }
        }
        
        return filtered;
      };

      if (Array.isArray(data)) {
        return data.map(item => filterObject(item));
      }
      
      return filterObject(data);
    };

    // Helper function to resolve expressions like {{json.field}} or {{json.errors[0].message}}
    const resolveExpression = (template, data) => {
      if (typeof template !== 'string') return template;
      if (!template.includes('{{')) return template;
      
      return template.replace(/\{\{json\.([^}]+)\}\}/g, (match, path) => {
        try {
          // Handle array notation: errors[0].message
          const value = path.split(/\.|\[/).reduce((obj, key) => {
            // Remove trailing ] from array indices
            key = key.replace(/\]$/, '');
            return obj?.[key];
          }, data);
          
          return value !== undefined ? value : match;
        } catch (e) {
          return match;
        }
      });
    };

    // Helper function to generate success message
    const generateSuccessMessage = (data, property) => {
      if (Array.isArray(data)) {
        const count = data.length;
        if (count === 0) return "Query executed successfully";
        if (count === 1) return "1 record retrieved successfully";
        return `${count} records retrieved successfully`;
      }
      
      if (property === "rows") return "Query executed successfully";
      if (property === "data") return "Data retrieved successfully";
      
      return "Request completed successfully";
    };

    // Auto-detect data property
    let data = null;
    let detectedProperty = null;
    
    if (dataProperty && dataProperty.trim()) {
      data = item[dataProperty.trim()];
      detectedProperty = dataProperty.trim();
    } else {
      // Auto-detect common properties
      const commonProps = ["rows", "data", "items", "result", "results"];
      for (const prop of commonProps) {
        if (item[prop] !== undefined) {
          data = item[prop];
          detectedProperty = prop;
          break;
        }
      }
      
      // If no common property found, use entire item
      if (data === null) {
        data = item;
      }
    }

    // Filter fields
    data = filterFields(data, fieldsToInclude, fieldsToExclude);
    
    // Detect pagination metadata from input
    const paginationMeta = {
      page: item.page || item.current_page || null,
      perPage: item.perPage || item.per_page || item.limit || null,
      total: item.total || item.rowCount || null,
      lastPage: item.lastPage || item.last_page || null,
      from: item.from || null,
      to: item.to || null,
    };
    
    // Calculate pagination values if we have enough info
    if (paginationMeta.total !== null && paginationMeta.perPage !== null && paginationMeta.page === null) {
      paginationMeta.page = 1; // Default to page 1
    }
    if (paginationMeta.total !== null && paginationMeta.perPage !== null && paginationMeta.lastPage === null) {
      paginationMeta.lastPage = Math.ceil(paginationMeta.total / paginationMeta.perPage);
    }
    if (Array.isArray(data) && paginationMeta.page !== null && paginationMeta.perPage !== null) {
      if (paginationMeta.from === null) {
        paginationMeta.from = data.length > 0 ? ((paginationMeta.page - 1) * paginationMeta.perPage) + 1 : null;
      }
      if (paginationMeta.to === null) {
        paginationMeta.to = data.length > 0 ? paginationMeta.from + data.length - 1 : null;
      }
    }
    
    const hasPagination = paginationMeta.page !== null || paginationMeta.total !== null;
    
    // Handle single object unwrapping (skip if paginated)
    if (Array.isArray(data) && !hasPagination) {
      if (returnSingleObject === "auto" && data.length === 1) {
        data = data[0]; // Unwrap single-item array
      } else if (returnSingleObject === "object" && data.length > 0) {
        data = data[0]; // Always return first item as object
      }
      // If returnSingleObject === "array", keep as array
    }

    // Check if this is error data (from validator invalid output, etc.)
    const isErrorData = item.valid === false || item._error || item.error || item.errors;
    
    // Auto-detect status code
    if (statusCode === "auto") {
      if (isErrorData) {
        // Error data - check for validation errors vs other errors
        if (item.errors && Array.isArray(item.errors)) {
          statusCode = 422; // Validation error
        } else {
          statusCode = item.statusCode || 500; // Server error
        }
      } else {
        // Empty arrays are valid successful responses (e.g., database queries with no results)
        // Only treat as 404 if explicitly marked or if it's a single object lookup that failed
        statusCode = 200; // Success
      }
    }

    // Build response
    let responseBody;
    if (wrapResponse) {
      const isError = statusCode >= 400;
      
      // Try to extract error message from various fields
      let errorMessage = null;
      if (isError || isErrorData) {
        for (const field of errorFields) {
          if (item[field]) {
            if (Array.isArray(item[field])) {
              // Validation errors array
              errorMessage = item[field].map(e => e.message || e).join(', ');
            } else if (typeof item[field] === 'object' && item[field].message) {
              errorMessage = item[field].message;
            } else if (typeof item[field] === 'string') {
              errorMessage = item[field];
            }
            if (errorMessage) break;
          }
        }
        if (!errorMessage) errorMessage = "An error occurred";
      }
      
      // Resolve expressions in custom message
      let finalMessage = customMessage || (isError ? errorMessage : generateSuccessMessage(data, detectedProperty));
      finalMessage = resolveExpression(finalMessage, item);
      
      responseBody = {
        success: !isError,
        message: finalMessage,
      };
      
      // Add data or errors
      if (isError || isErrorData) {
        // Error response
        if (item.errors) {
          responseBody.errors = item.errors;
        }
        // Only include data if explicitly enabled
        if (includeDataInError && item.data) {
          responseBody.data = item.data;
        }
      } else {
        // Success response
        responseBody.data = data;
        
        // Add pagination metadata for arrays
        if (Array.isArray(data) && paginationFormat !== "none") {
          if (paginationFormat === "laravel" && hasPagination) {
            // Laravel-style pagination
            const currentPage = paginationMeta.page || 1;
            const lastPage = paginationMeta.lastPage || 1;
            
            // Use the webhook URL from the webhook trigger
            const webhookUrl = item.webhookUrl || item.path || "/";
            
            // Build query string helper
            const buildUrl = (page) => {
              if (!page) return webhookUrl;
              return `${webhookUrl}?page=${page}`;
            };
            
            responseBody.links = {
              first: buildUrl(1),
              last: buildUrl(lastPage),
              prev: currentPage > 1 ? buildUrl(currentPage - 1) : null,
              next: currentPage < lastPage ? buildUrl(currentPage + 1) : null,
            };
            
            responseBody.meta = {
              current_page: currentPage,
              from: paginationMeta.from,
              last_page: lastPage,
              path: webhookUrl,
              per_page: paginationMeta.perPage || data.length,
              to: paginationMeta.to,
              total: paginationMeta.total || data.length,
            };
            
            // Remove simple count/total from root
            delete responseBody.success;
            delete responseBody.message;
          } else {
            // Simple pagination (default)
            responseBody.count = data.length;
            if (paginationMeta.total !== null) {
              responseBody.total = paginationMeta.total;
            }
            if (paginationMeta.page !== null) {
              responseBody.page = paginationMeta.page;
            }
            if (paginationMeta.perPage !== null) {
              responseBody.perPage = paginationMeta.perPage;
            }
          }
        }
      }
    } else {
      responseBody = data;
    }

    // Build headers
    const headers = {
      "Content-Type": "application/json",
    };

    if (enableCors) {
      headers["Access-Control-Allow-Origin"] = "*";
      headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    }

    this.logger.info("API Response prepared", {
      statusCode,
      dataType: Array.isArray(data) ? "array" : typeof data,
      count: Array.isArray(data) ? data.length : undefined,
      detectedProperty,
    });

    // Return response
    return [{
      main: [{
        json: responseBody,
        binary: {},
        pairedItem: { item: 0 },
        _httpResponseData: {
          statusCode,
          headers,
          body: responseBody,
          cookies: [],
          _httpResponse: true,
        }
      }]
    }];
  },


};

module.exports = ApiResponseNode;

# API Response Node 🚀

Laravel-style REST API response builder with smart auto-detection.

## Why Use This Instead of HTTP Response?

### Before (Manual Setup):
```
PostgreSQL → Request Parser (configure fields) → HTTP Response (configure format)
```

### After (Auto-Magic):
```
PostgreSQL → API Response ✨
```

## Key Features

### 1. **Auto-Detection**
- Automatically finds data in `rows`, `data`, `items`, `result`, `results`
- No need to specify property names
- Works with any database or API node

### 2. **Security by Default**
- Automatically excludes sensitive fields: `password`, `resetToken`, `resetTokenExpiry`
- Easy to add more exclusions

### 3. **Consistent Format**
```json
{
  "success": true,
  "data": [...],
  "message": "3 records retrieved successfully",
  "count": 3,
  "total": 3
}
```

### 4. **Smart Status Codes**
- Empty results → 404
- Errors → 500 (or custom)
- Success → 200
- All automatic!

### 5. **CORS Enabled by Default**
No more CORS errors during development.

## Examples

### Example 1: List Users (Zero Config)
**Input from PostgreSQL:**
```json
{
  "rows": [
    {"id": 1, "name": "John", "email": "john@example.com", "password": "hash123"},
    {"id": 2, "name": "Jane", "email": "jane@example.com", "password": "hash456"}
  ],
  "rowCount": 2
}
```

**Output (Auto):**
```json
{
  "success": true,
  "data": [
    {"id": 1, "name": "John", "email": "john@example.com"},
    {"id": 2, "name": "Jane", "email": "jane@example.com"}
  ],
  "message": "2 records retrieved successfully",
  "count": 2,
  "total": 2
}
```
*Note: `password` automatically excluded!*

### Example 2: Get Single User
**Fields to Include:** `id,name,email`

**Output:**
```json
{
  "success": true,
  "data": [
    {"id": 1, "name": "John", "email": "john@example.com"}
  ],
  "message": "1 record retrieved successfully",
  "count": 1
}
```

### Example 3: Empty Results
**Output:**
```json
{
  "success": false,
  "message": "No records found"
}
```
*Status: 404*

## Configuration

### Response Type
- **Auto-detect** (recommended): Smart detection
- **Success**: Force success response
- **Error**: Force error response
- **Paginated**: For pagination support

### Data Property
Leave empty for auto-detection, or specify: `rows`, `data`, `items`

### Fields to Include
Comma-separated: `id,name,email` (empty = all fields)

### Fields to Exclude
Default: `password,resetToken,resetTokenExpiry`

### Status Code
- **Auto** (recommended): Smart status codes
- Or choose specific: 200, 201, 404, 500, etc.

### Wrap Response
- **Enabled**: `{success, data, message}` format
- **Disabled**: Raw data only

## Comparison with HTTP Response

| Feature | API Response | HTTP Response |
|---------|-------------|---------------|
| Auto-detect data | ✅ | ❌ |
| Auto-exclude sensitive fields | ✅ | ❌ |
| Consistent format | ✅ | ⚠️ Manual |
| Smart status codes | ✅ | ⚠️ Manual |
| CORS by default | ✅ | ⚠️ Manual |
| Configuration needed | Minimal | Extensive |

## Use Cases

1. **Quick CRUD APIs**: Zero config for basic operations
2. **Secure by Default**: Auto-excludes passwords
3. **Consistent Responses**: Same format across all endpoints
4. **Rapid Prototyping**: Build APIs in minutes, not hours

## Tips

- Use with PostgreSQL, MySQL, MongoDB nodes
- Combine with Request Parser for input validation
- Perfect for building REST APIs quickly
- Laravel/Rails-style conventions

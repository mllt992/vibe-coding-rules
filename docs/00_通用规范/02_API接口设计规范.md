# 02 · API 接口设计规范

> 接口是模块的契约。契约一旦发布，**变更成本远高于设计成本**。

---

## 一、设计前置原则

1. **先设计契约，再写实现** —— 接口字段、状态码、错误格式定好，前后端可同时开工
2. **以业务语言命名** —— 不要让前端理解后端的内部分层
3. **稳定性优于美感** —— 已发布的接口能不动就不动；变更走版本号
4. **可观测性内建** —— 错误响应里有可追踪的标识

---

## 二、URL 设计

### REST 风格（默认推荐）

```
GET    /api/v1/users              列表
GET    /api/v1/users/{id}         详情
POST   /api/v1/users              创建
PUT    /api/v1/users/{id}         全量更新
PATCH  /api/v1/users/{id}         局部更新
DELETE /api/v1/users/{id}         删除
```

### 命名规则
- 资源用**复数名词**：`/users` 而不是 `/user`、`/getUser`
- 用 `kebab-case`：`/order-items` 而不是 `/orderItems` 或 `/order_items`
- 嵌套层级 ≤ 2：`/users/{id}/orders` 可以，`/users/{id}/orders/{id}/items` 改用查询参数 `/order-items?orderId=x`
- 路径不要带动词（除非是不可建模为资源的操作，如 `/auth/login`、`/orders/{id}/cancel`）

### 版本
- 强烈推荐 URL 中显式带版本号：`/api/v1/...`
- 版本升级时**保留旧版本至少一个迭代**，给调用方迁移时间

### 查询参数
- 列表过滤用 query：`/users?status=active&role=admin`
- 排序：`?sort=createdAt,-name`（`-` 表降序）
- 分页：明确"page 起始是 0 还是 1"并在团队统一

---

## 三、HTTP 状态码使用

| 类别 | 状态码 | 用途 |
|---|---|---|
| 2xx | 200 OK | 通用成功 |
|     | 201 Created | 创建成功，响应体含新资源 |
|     | 204 No Content | 操作成功无返回（如删除） |
| 4xx | 400 Bad Request | 参数错误、业务规则不通过 |
|     | 401 Unauthorized | 未登录、token 失效 |
|     | 403 Forbidden | 已登录但无权限 |
|     | 404 Not Found | 资源不存在 |
|     | 409 Conflict | 并发冲突、唯一约束冲突 |
|     | 422 Unprocessable Entity | 格式 OK 但业务校验失败（替代部分 400） |
|     | 429 Too Many Requests | 限流 |
| 5xx | 500 Internal Server Error | 服务端未预期错误 |
|     | 502/503 | 上游/服务不可用 |

### 红线
- ❌ 业务失败用 200 + body 里 `success: false`（除非项目历史遗留，新项目不允许）
- ❌ 所有错误都用 500
- ❌ 把 401 / 403 搞混（401 = 没登录，403 = 登录了但不让你看）

---

## 四、请求体与响应体

### 字段命名
- 统一 `camelCase`（前端友好）或统一 `snake_case`（看团队习惯，但**全项目统一**）
- 布尔字段加前缀：`isActive`、`hasChildren`
- 时间字段以 `At` / `Date` / `Time` 结尾：`createdAt`、`expiresAt`
- 金额字段加单位或精度暗示：`amountInCents` 或 `priceYuan`

### 类型规则
- **时间**：传输用 ISO-8601 字符串（`2026-05-13T10:00:00Z` 或带时区偏移）
- **金额**：用字符串或后端高精度数字类型，**禁止用 float**
- **id**：根据项目用 string 或 number，**全项目统一一种**
- **可空字段**：明确返回 `null`（不是 `""` 或 `0` 或省略字段）；前端按 null 判断

### 列表响应统一结构
```json
{
  "items": [...],
  "total": 123,
  "page": 1,
  "pageSize": 20
}
```
> 也可用 `data`、`list` 等名字，**全项目统一**。

### 错误响应统一结构
```json
{
  "code": "USER_NOT_FOUND",
  "message": "用户不存在",
  "details": [
    { "field": "email", "reason": "格式不合法" }
  ],
  "traceId": "abc123-xxx"
}
```
- `code`：可枚举的错误码字符串，前端可据此走分支
- `message`：面向用户/开发者的描述（注意是否需要 i18n）
- `details`：可选，字段级错误
- `traceId`：必含，便于日志关联

---

## 五、分页

- 起始：选 0 或 1，**全项目统一并在 API 文档中写清楚**
- 必须返回 `total` 或 `hasNext` 其一（推荐都返回）
- 大数据量场景考虑游标分页（`?cursor=xxx&limit=20`）代替页码分页
- 默认 pageSize 限制（如 20），最大 pageSize 限制（如 100），防止滥用

---

## 六、批量接口

- 命名：`POST /api/v1/users/batch`、`PUT /api/v1/orders/batch-cancel`
- **明确"部分成功"返回结构**：
  ```json
  {
    "successCount": 8,
    "failureCount": 2,
    "failures": [
      { "id": "x", "code": "INVALID_STATUS", "message": "..." }
    ]
  }
  ```
- **明确事务边界**：要么全部成功要么全部失败 / 允许部分成功（必须文档化）

---

## 七、幂等性

- `GET`、`PUT`、`DELETE` 天然幂等
- `POST` 创建类接口**必须支持幂等**——通过 `Idempotency-Key` Header 或业务唯一键
- 重复请求返回同样结果（包括同样的状态码），**不报错**

---

## 八、安全约束

- 所有接口默认需要鉴权；不需要鉴权的接口必须在文档中**显式标注**
- 敏感操作（删除、转账、改密）记录审计日志
- 列表接口必须在 SQL 层做行级权限过滤
- 详情/导出接口同样要做权限校验，**不能依赖前端隐藏入口**
- 入参严格校验（类型、长度、格式、范围），**禁止仅前端校验**
- 详见 `06_安全规范.md`

---

## 九、文档与契约

- 使用 OpenAPI / Swagger / 项目约定的接口文档形式
- **接口先文档化、再实现** —— 前后端依赖文档而不是口头沟通
- 字段变更必须更新文档，过期文档 = 错误文档
- 推荐：前端基于 OpenAPI 自动生成 TypeScript 类型，避免手抄

---

## 十、版本演进

| 变更类型 | 处置 |
|---|---|
| 加字段（向后兼容） | 直接在当前版本加 |
| 加可选参数 | 直接在当前版本加 |
| 必填参数变化 / 字段重命名 / 删字段 | 升版本号 `/api/v2/...` |
| 仅修复语义不改契约 | 不升版本，但变更需在文档 changelog 记录 |

---

## 十一、自检清单

设计完接口后逐条检查：

- [ ] 路径符合 REST 规范，使用复数 / kebab-case
- [ ] HTTP 方法用对
- [ ] 状态码语义正确
- [ ] 字段命名风格一致
- [ ] 时间/金额格式符合规范
- [ ] 错误响应包含 code、message、traceId
- [ ] 分页响应包含 total / hasNext
- [ ] 创建类接口考虑了幂等
- [ ] 权限校验已设计
- [ ] OpenAPI / 文档已同步更新
- [ ] 列出了所有 4xx 场景及对应错误码

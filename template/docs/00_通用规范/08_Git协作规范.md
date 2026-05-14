# 08 · Git 协作规范

> Git 历史是项目的第二份文档。乱了，未来的自己最受罪。

---

## 一、分支策略

### 推荐：Trunk-Based（小团队 / 快速迭代）
- `main`：始终可发布，受保护，只能通过 PR 合入
- `feature/*`：短生命周期（≤ 3 天），合入后即删
- 紧急修复：`hotfix/*` 直接基于 `main`，修完合回 `main`（必要时打 tag）

### 备选：Git Flow（大团队 / 多版本并行）
- `main`：发布版本
- `develop`：集成分支
- `feature/*`、`release/*`、`hotfix/*`
- 复杂度高，小项目不必

### 分支命名
- `feature/xxx-add-user-export`
- `bugfix/xxx-fix-login-redirect`
- `hotfix/xxx-payment-timeout`
- `refactor/xxx-split-order-service`
- `docs/xxx-update-readme`
- `chore/xxx-bump-deps`

> 前缀小写、`-` 连接、可选带 issue 号（`feature/123-...`）

---

## 二、提交（Commit）规范

### Conventional Commits（推荐）

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### type
| type | 含义 |
|---|---|
| feat | 新功能 |
| fix | BUG 修复 |
| refactor | 重构（不改外部行为） |
| perf | 性能优化 |
| docs | 文档变更 |
| test | 测试相关 |
| chore | 构建、依赖、配置等杂项 |
| style | 代码格式（不影响逻辑） |
| revert | 回滚之前的提交 |

### 示例
```
feat(user): add export to excel

支持按搜索条件导出用户列表为 Excel，包含基本信息和角色字段。
导出走后端流式生成，前端只下载。

Closes #123
```

### 提交信息规则
- subject **用一句话说清做了什么**，≤ 72 字符
- subject **用动词开头**（"添加"、"修复"、"删除"），不写句号
- 跨多行变更时 body 描述"为什么"，**不是"怎么做"**（代码自己说明）
- 关联 issue 用 footer（`Closes #123`、`Refs #456`）

### 红线
- ❌ "update"、"fix"、"修改"、"WIP" 这类无信息提交
- ❌ 把多个不相关变更挤在一个提交里
- ❌ subject 复制 body 的第一行

---

## 三、提交粒度

### 原则
- 一个提交 = 一个原子变更（重命名、加字段、修一个 BUG）
- 提交可被独立 revert 而不破坏其他功能
- 大功能分多次提交，**让 reviewer 能按时间线理解你的思考**

### 反例
- ❌ "完成用户模块" —— 包含 30 个文件 2000 行变更
- ❌ "WIP fix bugs" —— 不知道修了什么
- ❌ 一次提交里既加功能又删无关代码又改格式

---

## 四、Pull Request / Merge Request

### PR 标题
- 简洁但具体：`feat(user): 添加导出功能`
- 不写"修改若干"、"see body"
- 长度 ≤ 70 字符

### PR 描述
推荐模板：
```markdown
## 背景 / 目的
（这个 PR 解决什么问题？关联哪个需求/BUG？）

## 改动内容
- 主要改动 1
- 主要改动 2
- 主要改动 3

## 影响范围
- 哪些模块被改动
- 是否破坏现有功能（兼容性）
- 是否需要数据迁移
- 是否需要配置变更

## 测试
- [ ] 单元测试：xxx 模块覆盖率 NN%
- [ ] 接口测试：POST /api/xx happy + 4xx + 权限场景
- [ ] 手工烟测：登录 → xxx → 校验
- [ ] 回归：相邻模块 A / B 主流程

## 关联
- 需求文档：docs/01_需求分析/xxx.md
- 实施方案：docs/02_功能设计/xxx.md
- 关联 issue：#123
```

### PR 规模
- 推荐 ≤ 400 行变更
- 超过 800 行强烈建议拆分（除非是机械变更如重命名、生成代码）
- 大 PR 是审查的最大敌人，**不是因为审查者懒，是因为大脑就只能审这么多**

### 合并方式
- **优先 Squash and Merge**：保持 main 历史干净
- 大量原子提交且每个都有价值：可用 Rebase Merge
- **避免** Merge Commit 污染主干（除非合并发布分支）

---

## 五、Code Review 在 PR 中的角色

详见 `103_代码审查工作流程.md`。

### PR 流程
1. 作者自审通过 → 发起 PR
2. CI 通过 → reviewer 介入
3. reviewer 评论 → 作者回应/修改 → 再次 review
4. 必修项全部解决 → approve
5. 合并

### 红线
- ❌ 不看 diff 直接 LGTM
- ❌ 作者无视 reviewer 评论强行合并
- ❌ CI 红的 PR 合入 main
- ❌ 合入前最后一刻塞无关变更

---

## 六、版本与发布

### Tag
- 使用语义化版本：`v<MAJOR>.<MINOR>.<PATCH>`
- 例：`v1.2.3` —— 重大改动 / 新功能 / BUG 修复
- 发布即打 tag，附 release notes

### Changelog
- 维护 `CHANGELOG.md`，按版本倒序
- 每个版本列出：新功能、修复、破坏性变更、依赖升级

---

## 七、特殊场景

### 临时保存
- 用 `git stash` 而不是创建 "WIP" 提交
- 长期工作中需要切分支时 stash 或开 worktree

### 撤销已合并的提交
- 用 `git revert` **新增一个反向提交**
- **禁止**对 `main` 强推 `--force`

### 提交了不该提交的（密钥、大文件）
- 立即吊销密钥
- 用 `git filter-repo` / `bfg` 清理历史，然后强推（**所有协作者需要重新 clone**）
- 通知团队

### Rebase vs Merge
- 个人分支整理：rebase 让历史线性
- 合并到 main：squash 或 merge（按团队约定）
- **不要对已推送的公共分支 rebase**

---

## 八、Git 与 AI 协作

### AI 提交时
- AI 自动提交需符合本规范
- Subject 描述要具体而非泛泛
- 不要一次提交几千行 AI 生成代码而不分批

### 提交署名
- AI 代为提交时建议在 footer 注明：
  ```
  Co-Authored-By: Claude (AI Assistant) <noreply@example.com>
  ```
- 责任仍在审核者（开发者）

---

## 九、自检清单

### 提交前
- [ ] 本次提交是一个原子变更
- [ ] subject 简洁具体，含 type 和 scope
- [ ] 无 console.log / TODO 残留（除明确标注）
- [ ] 无敏感信息（密钥、token、调试用账号密码）
- [ ] 本地 lint / 类型检查 / 测试已通过

### PR 发起前
- [ ] 自审过（见 `103_代码审查工作流程.md`）
- [ ] PR 描述按模板填写完整
- [ ] 变更涉及的文档已更新
- [ ] 测试覆盖到位
- [ ] CI 已绿

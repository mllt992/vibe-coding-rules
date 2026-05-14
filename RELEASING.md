# 发版指南

本仓库通过 **推 tag 触发 GitHub Actions 自动发 npm**。日常发版只要两条命令。

---

## 日常发版（每次都这么做）

```bash
# 1. 确保当前在 main，工作区干净
git status

# 2. bump 版本（三选一）
npm version patch    # 0.1.0 → 0.1.1，修 bug
npm version minor    # 0.1.0 → 0.2.0，加功能
npm version major    # 0.1.0 → 1.0.0,  破坏性变更

# ↑ 这一步会自动：改 package.json 的 version、git commit、打 tag

# 3. 推到 GitHub，连 tag 一起推
git push --follow-tags
```

推完就完事了。剩下的 GitHub Actions 会做：

1. 校验 tag (`v1.2.3`) 与 `package.json.version` (`1.2.3`) 一致
2. 跑 `npm run release:ci`，依次发：
   - `vibe-coding-rules@<版本>`
   - `@xrilang/vibe-coding-rules@<版本>`

去 **仓库页面 → Actions** 标签看进度。绿勾 = 已发布到 npm。

---

## 一次性配置（只做一次，之后忘掉）

> 如果 Actions 跑红，报 `401 Unauthorized` 或 `ENEEDAUTH`，多半是这一步没做。

### 1. 生成 npm Automation Token

1. 登录 [npmjs.com](https://www.npmjs.com/)
2. 右上角头像 → **Access Tokens**
3. **Generate New Token** → **Classic Token**
4. 选 **Automation**（这种类型在 CI 里能绕过 2FA）
5. 复制 `npm_xxxxx...`，**关掉页面就再也看不到了**

### 2. 加到 GitHub Secrets

1. 仓库页面 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name 填 `NPM_TOKEN`，Secret 粘贴上面的 token
4. **Add secret**

---

## 验证发布成功

```bash
# 查最新版本（应等于刚发的版本号）
npm view vibe-coding-rules version
npm view @xrilang/vibe-coding-rules version

# 试装一下
npx vibe-coding-rules@latest
```

也能在 npmjs.com 包页面看到包旁边有 **Provenance** 徽章（供应链溯源，workflow 自动加的）。

---

## 出错怎么办

### Actions 红了：tag 和 package.json 版本不一致

```
::error::Tag 0.1.1 does not match package.json version 0.1.0
```

通常是手动打 tag 时打错了。修法：

```bash
git tag -d v0.1.1                    # 删本地 tag
git push origin :refs/tags/v0.1.1    # 删远端 tag
# 然后重新走 npm version patch
```

### Actions 红了：401 / ENEEDAUTH

`NPM_TOKEN` 没配，或 token 过期/类型不对。回到「一次性配置」重做一遍，确保选 **Automation**。

### Actions 红了：403 You cannot publish over the previously published versions

这个版本已经在 npm 上了。CI 脚本有幂等处理，正常情况下重跑会跳过已发的包；如果还炸，说明短名和 scope 包**都**已发，直接 bump 下一个版本即可。

### 想撤回刚发的版本

72 小时内可以 unpublish：

```bash
npm unpublish vibe-coding-rules@<版本>
npm unpublish @xrilang/vibe-coding-rules@<版本>
```

超过 72 小时只能发新版本盖过去（npm 政策）。

---

## 应急：本地手动发版

CI 跑不通、又急着发，可以用本地交互式脚本（要 npm 账号开了 2FA 就准备好手机）：

```bash
npm run release
# 会问你 OTP，依次发两个包
```

这条路径与 CI 走同一份双发逻辑，只是手输 OTP 而非 token。

---

## 文件索引

- `.github/workflows/publish.yml` — tag 触发的 Actions
- `scripts/release-ci.mjs` — CI 用的非交互发布脚本
- `scripts/release.mjs` — 本地用的交互式发布脚本（应急）

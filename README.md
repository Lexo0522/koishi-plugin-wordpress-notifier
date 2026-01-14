# WordPress 文章自动推送插件

自动从 WordPress 网站获取最新文章并推送到指定 QQ 群或私聊。

## 功能特性

- ✅ 自动从 WordPress REST API 获取最新文章
- ✅ 定时推送新文章到指定 QQ 群或私聊
- ✅ 支持手动查询最新文章和文章列表
- ✅ 支持 @全体成员
- ✅ 完善的去重机制，避免重复推送
- ✅ 数据库持久化存储，机器人重启不丢失记录
- ✅ 采用服务模式架构，便于扩展和维护
- ✅ 支持自动推送开关

## 安装

### 通过 npm 安装

```bash
npm install koishi-plugin-wordpress-notifier
```

### 通过 Koishi 控制台安装

1. 打开 Koishi 控制台
2. 进入「插件市场」
3. 搜索 `wordpress-notifier`
4. 点击安装按钮

## 配置

在 `koishi.yml` 中配置插件：

```yaml
plugins:
  wordpress-notifier:
    wordpressUrl: 'https://your-wordpress-site.com'  # WordPress 网站地址
    interval: 3600000  # 检查间隔（毫秒，默认 1 小时）
    targets:
      - '2801323326'  # 推送目标（群号或 QQ 号）
    enableAutoPush: true  # 是否启用自动推送
    mentionAll: false  # 是否 @全体成员
    maxArticles: 5  # 每次最多推送的文章数量
```

### 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `wordpressUrl` | string | 必填 | WordPress 网站地址（例如：https://example.com） |
| `interval` | number | 3600000 | 检查间隔，单位毫秒（默认 1 小时 = 3600000 毫秒） |
| `targets` | array | 必填 | 推送目标列表，可以是群号或 QQ 号 |
| `enableAutoPush` | boolean | true | 是否启用自动推送 |
| `mentionAll` | boolean | false | 是否在推送时 @全体成员 |
| `maxArticles` | number | 5 | 每次最多推送的文章数量 |

## 使用命令

### 查看最新文章

```
/wordpress.latest
```

显示最新的 WordPress 文章列表，包含标题、日期和链接。

### 查看文章列表

```
/wordpress.list
```

显示文章 ID 和标题的简洁列表。

### 手动推送最新文章

```
/wordpress.push
```

立即检查并推送最新文章（即使自动推送已关闭）。

### 查看插件状态

```
/wordpress.status
```

显示当前插件配置状态，包括网站地址、检查间隔、推送目标等。

### 切换自动推送开关

```
/wordpress.toggle
```

开启或关闭自动推送功能。

### 切换 @全体成员 开关

```
/wordpress.mention
```

开启或关闭 @全体成员 功能。

### 插件菜单

```
/wordpress
```

显示插件菜单和所有可用命令。

## 工作原理

1. 插件启动时会自动创建数据库表 `wordpress_posts` 用于记录已推送的文章
2. 定时器每隔指定时间（默认 1 小时）检查一次 WordPress 网站的最新文章
3. 对于每篇新文章，检查是否已推送过
4. 如果是新文章，则格式化消息并推送到所有配置的目标
5. 推送成功后，将文章 ID 记录到数据库中

## 注意事项

- WordPress 网站必须启用 REST API（默认启用）
- 确保机器人有权限向目标群或私聊发送消息
- @全体成员 功能需要机器人有相应权限
- 建议设置合理的检查间隔，避免频繁请求 WordPress 网站
- 插件使用数据库持久化存储，机器人重启后不会重复推送已推送的文章

## 常见问题

### 为什么文章没有推送？

可能原因：
- WordPress 网站的 REST API 未启用
- 机器人没有向目标群或私聊发送消息的权限
- 文章已经被推送过（数据库中有记录）
- 自动推送功能已关闭

解决方法：
- 检查 WordPress 网站设置，确保 REST API 已启用
- 确认机器人在目标群中有发送消息权限
- 使用 `/wordpress.push` 命令手动触发推送
- 使用 `/wordpress.status` 检查插件状态

### 如何修改检查间隔？

在配置文件中修改 `interval` 参数：

```yaml
plugins:
  wordpress-notifier:
    interval: 1800000  # 30 分钟
```

建议：
- 频繁更新的网站：设置较短间隔（如 30 分钟）
- 更新较少的网站：设置较长间隔（如 2-4 小时）
- 避免设置过短间隔，以免频繁请求 WordPress 网站

### @全体成员 功能不生效？

可能原因：
- 机器人没有 @全体成员 的权限
- `mentionAll` 配置设置为 `false`

解决方法：
- 在群设置中授予机器人 @全体成员 权限
- 使用 `/wordpress.mention` 命令开启功能
- 或在配置文件中设置 `mentionAll: true`

### 支持推送到多个群吗？

支持！在配置文件中添加多个目标：

```yaml
targets:
  - '群号1'
  - '群号2'
  - 'QQ号'
```

### 机器人重启后会重复推送吗？

不会！插件使用数据库持久化存储已推送的文章记录，机器人重启后不会重复推送。

## 开发

插件位于 `external/wordpress-notifier/` 目录。

### 编译插件

```bash
cd external/wordpress-notifier
npm run build
```

### 重新安装依赖

```bash
cd external/wordpress-notifier
npm install
```

## 版本历史

### 1.2.0 (2024-01-14)

- 📝 优化 README.md 文档，添加详细的安装说明和常见问题
- 📦 优化 npm 包结构，只包含必要文件

### 1.1.0 (2024-01-14)

- ✨ 新增数据库持久化存储功能
- 🐛 修复推送目标配置问题，使用 `ctx.broadcast([target], message)` 正确发送到指定目标
- 🐛 修复 HTTP 服务注入问题，添加 `'http'` 到 inject 数组
- 📝 添加 `.npmignore` 文件，确保 npm 发布时只包含必要文件
- 📦 更新依赖项

### 1.0.0 (初始版本)

- 🎉 首次发布
- ✅ 基础推送功能
- ✅ 命令系统
- ✅ 去重机制

## 许可证

MIT

## 相关链接

- 插件仓库：https://github.com/Lexo0522/koishi-plugin-wordpress-notifier
- Koishi 官方文档：https://koishi.js.org/
- WordPress REST API 文档：https://developer.wordpress.com/rest-api/

## 安装（Install）

```bash
npm i koishi-plugin-wordpress-notifier
```

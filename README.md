# WordPress 文章自动推送插件

自动从 WordPress 网站获取最新文章并推送到指定 QQ 群或私聊。

## 功能特性

- 自动从 WordPress REST API 获取最新文章
- 定时推送新文章到指定 QQ 群或私聊
- 支持手动查询最新文章和文章列表
- 支持 @全体成员
- 完善的去重机制，避免重复推送
- 采用服务模式架构，便于扩展和维护
- 支持自动推送开关

## 安装

插件已集成到项目中，无需额外安装。

## 配置

在 `koishi.yml` 中配置插件：

```yaml
wordpress-notifier:
  wordpressUrl: 'https://your-wordpress-site.com'  # WordPress 网站地址
  interval: 3600000  # 检查间隔（毫秒，默认 1 小时）
  targets:
    - '2801323326'  # 推送目标（群号或 QQ 号）
  enableAutoPush: true  # 是否启用自动推送
  mentionAll: false  # 是否 @全体成员
  maxArticles: 5  # 每次最多推送的文章数量
```

## 使用命令

### 查看最新文章
```
wordpress.latest
```
显示最新的 WordPress 文章列表，包含标题、日期和链接。

### 查看文章列表
```
wordpress.list
```
显示文章 ID 和标题的简洁列表。

### 手动推送最新文章
```
wordpress.push
```
立即检查并推送最新文章（即使自动推送已关闭）。

### 查看插件状态
```
wordpress.status
```
显示当前插件配置状态，包括网站地址、检查间隔、推送目标等。

### 切换自动推送开关
```
wordpress.toggle
```
开启或关闭自动推送功能。

### 切换 @全体成员 开关
```
wordpress.mention
```
开启或关闭 @全体成员 功能。

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

## 开发

插件位于 `external/wordpress-notifier/` 目录。

### 编译插件
```bash
cd external/wordpress-notifier
yarn build
```

### 重新安装依赖
```bash
cd external/wordpress-notifier
yarn install
```

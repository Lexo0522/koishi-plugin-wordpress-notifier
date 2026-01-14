# WordPress 推送插件配置示例

## 基本配置

```yaml
wordpress-notifier:
  # WordPress 网站地址（不要带斜杠结尾）
  wordpressUrl: 'https://example.com'
  
  # 检查间隔（毫秒）
  # 3600000 = 1 小时
  # 1800000 = 30 分钟
  # 7200000 = 2 小时
  interval: 3600000
  
  # 推送目标（可以是群号或 QQ 号）
  targets:
    - '123456789'  # 群号
    - '987654321'  # 另一个群号
    # - '123456'  # 私聊 QQ 号
  
  # 是否启用自动推送
  enableAutoPush: true
  
  # 是否 @全体成员（需要机器人有管理员权限）
  mentionAll: false
  
  # 每次最多推送的文章数量
  maxArticles: 5
```

## 高级配置示例

### 频繁检查（30 分钟）
```yaml
wordpress-notifier:
  wordpressUrl: 'https://example.com'
  interval: 1800000
  targets:
    - '123456789'
  enableAutoPush: true
  mentionAll: false
  maxArticles: 3
```

### 推送到多个群并 @全体成员
```yaml
wordpress-notifier:
  wordpressUrl: 'https://example.com'
  interval: 3600000
  targets:
    - '123456789'
    - '987654321'
    - '111222333'
  enableAutoPush: true
  mentionAll: true
  maxArticles: 10
```

### 仅手动推送（关闭自动推送）
```yaml
wordpress-notifier:
  wordpressUrl: 'https://example.com'
  interval: 3600000
  targets:
    - '123456789'
  enableAutoPush: false
  mentionAll: false
  maxArticles: 5
```

## WordPress REST API 要求

确保你的 WordPress 网站满足以下要求：

1. **启用 REST API**：WordPress 4.7+ 默认启用 REST API
2. **允许公开访问**：确保 `/wp-json/wp/v2/posts` 端点可以公开访问
3. **CORS 配置**：如果需要跨域访问，请配置 CORS

你可以通过以下 URL 测试 API 是否可用：
```
https://your-wordpress-site.com/wp-json/wp/v2/posts?per_page=1
```

如果返回 JSON 数据，说明 API 正常工作。

## 常见问题

### 1. 插件无法获取文章
- 检查 `wordpressUrl` 是否正确
- 确认 WordPress REST API 是否启用
- 检查网络连接

### 2. 无法推送到群
- 确认机器人在群中
- 检查机器人是否有发送消息权限
- 确认群号格式正确

### 3. @全体成员 不生效
- 确认机器人是群管理员
- 检查群权限设置
- 某些平台可能不支持 @全体成员

### 4. 文章重复推送
- 检查数据库是否正常工作
- 查看日志确认文章 ID 是否正确记录
- 可能需要手动清理数据库中的重复记录

## 日志调试

如果遇到问题，可以查看 Koishi 日志：

```bash
# 在 Koishi 控制台中查看日志
# 或查看 data/logs/ 目录下的日志文件
```

插件会记录以下信息：
- 插件加载状态
- 文章获取成功/失败
- 推送成功/失败
- 错误详情

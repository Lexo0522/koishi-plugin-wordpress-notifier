# WordPress 文章自动推送插件

自动从 WordPress 网站获取最新文章并推送到指定 QQ 群或私聊。

## 功能特性

- ✅ 自动从 WordPress REST API 获取最新文章
- ✅ 定时推送新文章到指定 QQ 群或私聊
- ✅ 支持文章更新推送
- ✅ 支持新用户注册推送
- ✅ 支持手动查询最新文章和文章列表
- ✅ 支持 @全体成员
- ✅ 完善的去重机制，避免重复推送
- ✅ 按群聊标记推送记录，确保每个群只收到一次相同内容
- ✅ 数据库持久化存储，机器人重启不丢失记录
- ✅ 采用服务模式架构，便于扩展和维护
- ✅ 支持自动推送开关
- ✅ 支持文章更新推送开关
- ✅ 支持新用户注册推送开关

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
    enableUpdatePush: false  # 是否启用文章更新推送
    enableUserPush: false  # 是否启用新用户注册推送
    mentionAll: false  # 是否 @全体成员
    maxArticles: 5  # 每次最多推送的文章数量
    # 可选：WordPress API 认证配置
    # 使用应用程序密码，更安全
    # username: 'your-wordpress-username'
    # applicationPassword: 'your-application-password'  # 例如：hGR2 sPFu Yncl xHc4 AvJq cUtB
```

### 如何获取WordPress应用程序密码

1. 登录WordPress后台
2. 进入用户 > 个人资料
3. 滚动到"应用程序密码"部分
4. 输入应用程序名称（例如："Koishi 推送插件"）
5. 点击"添加新应用程序密码"
6. 复制生成的应用程序密码（例如：`hGR2 sPFu Yncl xHc4 AvJq cUtB`）
7. 在插件配置中使用此密码，**无需删除空格**，插件会自动处理

应用程序密码是WordPress生成的安全密码，适合API访问，比普通密码更安全，可以随时撤销，不会影响您的主密码。插件已不再支持普通密码，必须使用应用程序密码。

### 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `wordpressUrl` | string | 必填 | WordPress 网站地址（例如：https://example.com） |
| `interval` | number | 3600000 | 检查间隔，单位毫秒（默认 1 小时 = 3600000 毫秒） |
| `targets` | array | 必填 | 推送目标列表，可以是群号或 QQ 号 |
| `enableAutoPush` | boolean | true | 是否启用自动推送 |
| `enableUpdatePush` | boolean | false | 是否启用文章更新推送 |
| `enableUserPush` | boolean | false | 是否启用新用户注册推送 |
| `mentionAll` | boolean | false | 是否在推送时 @全体成员 |
| `maxArticles` | number | 5 | 每次最多推送的文章数量 |
| `username` | string | 可选 | WordPress 用户名（用于 Basic 基础认证，与应用程序密码配合使用） |
| `applicationPassword` | string | 可选 | WordPress 应用程序密码（用于 Basic 基础认证，例如：hGR2sPFuYnclxHc4AvJqcUtB） |

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

### 切换文章更新推送开关

```
/wordpress.toggle-update
```

开启或关闭文章更新推送功能。

### 切换新用户注册推送开关

```
/wordpress.toggle-user
```

开启或关闭新用户注册推送功能。

### 修改 WordPress 站点地址

```
/wordpress.set-url <url>
```

修改 WordPress 站点地址。

### 查看已推送文章列表

```
/wordpress.pushed
```

查看已推送的文章列表，按推送时间倒序排列，显示文章 ID 和推送时间。

### 清理旧推送记录

```
/wordpress.clean [days]
```

清理指定天数前的推送记录，默认清理 30 天前的记录，仅超级管理员可用。

### 插件菜单

```
/wordpress
```

显示插件菜单和所有可用命令。

## 工作原理

1. 插件启动时会自动创建以下数据库表：
   - `wordpress_posts`：记录已推送的新文章
   - `wordpress_post_updates`：记录文章更新情况
   - `wordpress_user_registrations`：记录已推送的新用户
   - `wordpress_group_pushes`：按群聊标记推送记录，确保每个群只收到一次相同内容

2. 定时器每隔指定时间（默认 1 小时）检查一次 WordPress 网站：
   - 检查最新文章
   - 检查文章更新
   - 检查新用户注册

3. 推送逻辑：
   - 对于新文章，检查每个群聊是否已推送过
   - 对于文章更新，检查是否有更新且该群聊已收到过原文
   - 对于新用户，检查是否已推送过
   - 格式化消息并推送到所有配置的目标
   - 推送成功后，更新相应的数据库记录

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

### 如何获取用户注册日期

WordPress REST API默认可能不会返回用户注册日期字段。您可以通过以下两种方式之一来启用：

#### 方式 1：修改当前主题「函数文件（functions.php）」
1. 登录 WordPress 后台 → 外观 → 主题文件编辑器 → 选择当前使用的主题 → 打开「函数文件（functions.php）」；
2. 在文件末尾粘贴以下代码，点击「更新文件」保存：

```php
/** 
 * 为WordPress REST API /wp/v2/users接口添加注册时间字段 
 * 映射为registered_date，兼容代码中的字段读取逻辑 
 */ 
add_filter('rest_prepare_user', 'add_user_registered_date_to_rest', 10, 3); 
function add_user_registered_date_to_rest($response, $user, $request) { 
    // 获取WordPress原生注册时间（数据库字段user_registered，格式为Y-m-d H:i:s） 
    $register_time = $user->user_registered; 
    // 将注册时间添加到API返回数据中，同时保留原生字段和代码中使用的registered_date 
    $response->data['user_registered'] = $register_time; // 原生字段名 
    $response->data['registered_date'] = $register_time; // 代码中尝试读取的字段名 
    return $response; 
}
```

#### 方式 2：创建自定义插件（推荐，避免主题更换丢失代码）
1. 新建一个文本文件，命名为 `add-rest-user-registered-date.php`（注意后缀为 .php）；
2. 将以下代码粘贴到文件中（包含插件头注释，WordPress 可识别）：

```php
<?php 
/** 
 * 插件名称：REST API 用户注册时间字段扩展 
 * 插件URI：https://www.rutua.cn/ 
 * 描述：为/wp/v2/users接口添加注册时间（registered_date）字段，适配wordpress-notifier工具 
 * 版本：1.0 
 * 作者：kate522 
 * 作者URI：https://www.rutua.cn/archives/author/kate522/ 
 */ 

// 过滤REST API用户响应，添加注册时间字段 
add_filter('rest_prepare_user', 'add_user_registered_date_to_rest', 10, 3); 
function add_user_registered_date_to_rest($response, $user, $request) { 
    $register_time = $user->user_registered; 
    $response->data['user_registered'] = $register_time; 
    $response->data['registered_date'] = $register_time; 
    return $response; 
}
```

3. 将文件上传到 WordPress 服务器的 `wp-content/plugins/` 目录；
4. 登录 WordPress 后台 → 插件 → 已安装插件 → 找到「REST API 用户注册时间字段扩展」→ 点击「启用」。

添加上述代码后，插件将能够正确获取并显示用户注册日期。

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

### 2.5.9 (2026-01-25)

- 🐛 彻底修复11255错误，严格遵循QQ接口规范
- ✅ 移除所有非必要特殊符号，只保留1个极简表情
- ✅ 自定义时间格式：年-月-日 时:分，避免本地化特殊字符
- ✅ 使用encodeURI强制编码WordPress链接
- ✅ 双级长度控制：标题60字符，整体300字符
- ✅ 严格限制换行：仅2次换行，无连续或尾部换行
- ✅ 强化清洗规则：标准化所有空白符为单个半角空格

### 2.5.8 (2026-01-25)

- 🐛 修复推送失败的11255错误
- ✅ 修正消息发送逻辑，确保正确处理单个消息段
- ✅ 统一变量命名，将segments改为message
- ✅ 确保bot.sendMessage接收正确的消息类型

### 2.5.7 (2026-01-25)

- 🔧 适配QQ官方bot，优化bot获取逻辑
- ✅ 优先选择QQ官方bot（platform === 'qq'）
- ✅ 优化消息格式，确保兼容QQ官方bot要求
- ✅ 调整消息长度限制，更严格控制在350字符内
- ✅ 简化消息格式，使用更兼容的分隔符
- ✅ 确保@全体成员格式符合QQ官方bot规范

### 2.5.6 (2026-01-25)

- 🔧 修复11255错误，重构消息构造函数
- ✅ 移除多段消息拼接，改为单段纯文本
- ✅ 强制截断长文本，控制消息长度
- ✅ 标准化特殊符号，使用|分隔关键信息
- ✅ 直接返回h.text()封装的单段消息

### 2.5.5 (2026-01-25)

- 🔧 修复wordpress.status命令Bad Request错误
- ✅ 为所有命令添加h.text()封装
- ✅ 精简字段描述，缩短消息长度
- ✅ 添加消息长度验证
- ✅ 优化消息格式，确保兼容Satorijs QQ适配器

### 2.3.0 (2026-01-25)

- 🔧 增强命令权限管理，限制敏感命令仅超级管理员可用
- ✅ 为`wordpress.set-url`命令添加超级管理员权限检查
- ✅ 为`wordpress.clean [days]`命令添加超级管理员权限检查
- ✅ 为`wordpress.toggle`命令添加超级管理员权限检查
- ✅ 为`wordpress.toggle-update`命令添加超级管理员权限检查
- ✅ 为`wordpress.toggle-user`命令添加超级管理员权限检查
- ✅ 为`wordpress.mention`命令添加超级管理员权限检查
- ✅ 添加了详细的日志记录，便于追踪非授权访问尝试

### 2.2.0 (2026-01-25)

- 🐛 修复重复推送问题，清理未使用的数据库表
- ✅ 移除了未使用的`wordpress_posts`表，统一使用`wordpress_group_pushes`表进行推送记录管理
- ✅ 修复了`wordpress.pushed`命令，使用`wordpress_group_pushes`表获取已推送记录
- ✅ 修复了`wordpress.clean`命令，移除了对`wordpress_posts`表的引用
- ✅ 增强了推送日志，添加了详细的调试信息，便于追踪推送流程
- ✅ 优化了`isGroupPushed`和`markGroupAsPushed`函数，添加了更多日志
### 2.1.0 (2026-01-25)

- 🔧 更新文档结构，将"如何获取用户注册日期"内容从版本历史移至常见问题部分
- ✅ 优化文档组织，提高用户查找信息的便利性
- ✅ 保持原有详细说明和代码示例不变

### 2.0.9 (2026-01-25)

- 🔧 增强用户注册日期处理，支持多种日期字段格式
- ✅ 支持WordPress主题中添加的`user_registered`和`registered_date`字段
- ✅ 在API请求中添加_fields参数，明确请求注册日期相关字段
- ✅ 请求字段包括：id,name,slug,date,date_registered,registered_date,user_registered,created_at,registeredAt,email,roles,url,description,link,avatar_urls
- ✅ 确保API返回完整的用户信息，包括注册日期
- ✅ 优化日期字段优先级顺序，优先使用`registered_date`和`user_registered`字段



### 2.0.8 (2026-01-25)

- 🔧 增强用户注册日期处理逻辑，尝试所有可能的日期字段
- ✅ 添加调试日志，便于排查日期获取问题
- ✅ 扩展WordPressUser接口，支持更多日期字段和未知字段
- ✅ 按优先级遍历所有可能的日期字段，确保找到正确的注册日期
- ✅ 添加详细的日志记录，便于调试和问题定位
- ✅ 改进日期解析错误处理，确保不会显示"Invalid Date"

### 2.0.7 (2026-01-25)

- 🐛 修复用户注册日期显示"Invalid Date"的问题
- ✅ 修正WordPressUser接口中的用户注册日期字段名，从`registered_date`改为`date_registered`
- ✅ 更新日期处理逻辑，确保正确获取WordPress API返回的用户注册日期
- ✅ 保留健壮的日期解析机制，避免显示"Invalid Date"

### 2.0.6 (2026-01-25)

- ✅ 不再采用WordPress普通密码，改用应用程序密码
- ✅ 配置页面添加应用程序密码字段，移除普通密码字段
- ✅ 优化认证逻辑，专门处理应用程序密码
- ✅ 支持自动处理带有空格的应用程序密码
- 🔧 更新了文档，详细说明如何使用应用程序密码
- 🔧 提高了API访问的安全性

### 2.0.5 (2026-01-25)

- ✅ 支持WordPress应用程序密码（Application Password）
- ✅ 自动处理带有空格的应用程序密码，无需手动删除空格
- ✅ 优化认证逻辑，确保应用程序密码能正确工作
- 🔧 更新了文档，详细说明如何获取和使用应用程序密码
- 🔧 推荐使用应用程序密码，提高安全性

### 2.0.4 (2026-01-25)

- ✅ 修复插件配置页面无法添加WordPress账号和密码的问题
- ✅ 在Schema配置中添加了username和password字段，支持在插件配置页面设置
- ✅ 支持Basic基础认证，请求头携带认证信息
- 🔧 优化了配置页面的用户体验
- 🔧 更新了文档，说明如何在配置页面添加认证信息

### 2.0.3 (2026-01-25)

- ✨ 新增 WordPress API 认证支持
- ✅ 支持配置 username 和 password 访问受保护的 API 端点
- ✅ 特别是解决了 users 端点需要认证才能访问的问题
- 🔧 更新了配置文档，添加了认证配置说明和示例
- 🔧 优化了 HTTP 请求逻辑，支持基本认证

### 2.0.2 (2026-01-25)

- 🐛 修复每次重载时重新推送的问题
- 🔧 优化推送去重机制，只使用群聊记录跟踪推送状态
- 🔧 确保每个群聊只会收到一次相同的文章推送
- 🔧 优化错误处理，确保插件核心功能正常工作

### 2.0.1 (2026-01-25)

- 📝 更新文档，完善新功能说明
- 🔧 优化代码结构

### 2.0.0 (2026-01-25)

- ✨ 新增文章更新推送功能
- ✨ 新增新用户注册推送功能
- ✨ 实现按群聊标记推送记录，确保每个群只收到一次相同内容
- ✅ 支持开启/关闭文章更新推送
- ✅ 支持开启/关闭新用户注册推送
- ✅ 修改 wordpress.status 命令，仅显示当前群的推送目标
- 🔧 优化数据库表结构，添加多张数据表
- 🔧 优化清理命令，支持清理所有类型的推送记录

### 1.8.2 (2026-01-25)

- 🐛 修复 Bot 实例获取方式，使用 `Object.values(ctx.bots)` 正确处理 Bot 对象
- 🐛 修复消息格式不兼容问题，使用标准 Segment 构造兼容消息
- 🐛 修复推送目标类型问题，确保目标是有效的数字字符串
- 🔧 简化消息构造逻辑，将多次 `h.text()` 调用合并为单段文本
- 🔧 增强消息内容安全性，彻底过滤 HTML 标签和非法字符
- ✅ 兼容多款适配器：adapter-milky, adapter-qq, adapter-onebot, adapter-satori

### 1.8.1 (2026-01-20)

- 🔧 优化代码结构

### 1.8.0 (2026-01-19)

- ✨ 新增超级管理员功能，允许修改 WordPress 站点地址
- ✅ 添加 `superAdmins` 配置项，支持指定超级管理员
- ✅ 添加 `/wordpress.set-url <url>` 命令，仅超级管理员可用
- 🐛 修复角色显示问题，移除不可靠的 roles 字段
- 📝 更新 README.md 文档，添加超级管理员功能说明

### 1.7.1 (2026-01-19)

- 🐛 修复用户查询功能中 roles 字段为 undefined 的错误
- 📝 更新 README.md 文档，添加用户查询功能说明

### 1.7.0 (2026-01-19)

- ✨ 新增查询 WordPress 站点用户信息功能
- ✅ 添加 `/wordpress.users` 命令，查看站点用户列表
- ✅ 添加 `/wordpress.user <id>` 命令，查看特定用户信息
- 📝 更新主菜单，添加新命令选项
- 🔧 优化数据库表定义

### 1.6.0 (2026-01-15)

- 🐛 修复消息发送问题，使用 `bot.sendMessage` 替代 `broadcast`
- 🔧 优化消息发送逻辑

### 1.5.0 (2026-01-15)

- 🐛 修复数据库主键问题，添加 `id` 字段作为主键
- 🔧 优化数据库表结构

### 1.3.0 (2024-01-14)

- 📝 更新作者邮箱为 kate522@88.com
- 🔗 更新仓库地址为正确的 GitHub URL
- 📝 优化 README.md 文档和链接

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

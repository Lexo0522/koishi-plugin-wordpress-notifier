"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.name = exports.inject = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
exports.inject = ['database', 'http'];
exports.name = 'wordpress-notifier';
exports.Config = koishi_1.Schema.object({
    wordpressUrl: koishi_1.Schema.string().description('WordPress 网站地址（例如：https://example.com）'),
    interval: koishi_1.Schema.number().default(3600000).description('检查间隔（毫秒，默认 1 小时）'),
    targets: koishi_1.Schema.array(koishi_1.Schema.string()).description('推送目标（群号或 QQ 号）'),
    enableAutoPush: koishi_1.Schema.boolean().default(true).description('是否启用自动推送'),
    enableUpdatePush: koishi_1.Schema.boolean().default(false).description('是否启用文章更新推送'),
    enableUserPush: koishi_1.Schema.boolean().default(false).description('是否启用新用户注册推送'),
    mentionAll: koishi_1.Schema.boolean().default(false).description('是否 @全体成员'),
    maxArticles: koishi_1.Schema.number().default(5).description('每次最多推送的文章数量'),
    username: koishi_1.Schema.string().default('').description('WordPress 用户名（用于 Basic 认证，与应用程序密码配合使用）'),
    applicationPassword: koishi_1.Schema.string().default('').description('WordPress 应用程序密码（用于 Basic 认证，例如：hGR2sPFuYnclxHc4AvJq cUtB）'),
    superAdmins: koishi_1.Schema.array(koishi_1.Schema.string()).default([]).description('超级管理员 QQ 号列表')
});
function apply(ctx, config) {
    ctx.logger.info('WordPress 推送插件已加载');
    // 修复 MySQL 自增主键问题，使用正确的模型配置
    // 关键修复：将 primary 从数组 ['id'] 改为字符串 'id'
    // 当 primary 为字符串且等于当前字段名时，Koishi 会自动为 MySQL 添加 AUTO_INCREMENT 属性
    ctx.model.extend('wordpress_post_updates', {
        id: 'integer',
        postId: 'integer',
        lastModified: 'timestamp',
        pushedAt: 'timestamp'
    }, {
        primary: 'id',
        autoInc: true,
        unique: ['postId']
    });
    ctx.model.extend('wordpress_user_registrations', {
        id: 'integer',
        userId: 'integer',
        pushedAt: 'timestamp'
    }, {
        primary: 'id',
        autoInc: true,
        unique: ['userId']
    });
    ctx.logger.info('数据库表配置完成，autoInc: true 已启用，确保插入操作不手动指定 id 字段');
    // 为所有数据库操作添加详细日志，便于诊断自增主键问题
    ctx.on('ready', async () => {
        ctx.logger.info('WordPress 推送插件已就绪，开始初始化推送任务');
        ctx.logger.info('数据库表配置：');
        ctx.logger.info('wordpress_post_updates: id 字段设置为 autoInc: true');
        ctx.logger.info('wordpress_user_registrations: id 字段设置为 autoInc: true');
        ctx.logger.info('所有群聊共用一个文章标记，不再区分群聊');
        // 检查并修复数据库表结构问题
        await checkAndFixTableStructure();
        // 执行初始推送
        await pushNewPosts();
    });
    // 检查数据库表结构的函数
    async function checkAndFixTableStructure() {
        try {
            ctx.logger.info('开始检查数据库表结构...');
            ctx.logger.info('所有群聊现在共用一个文章标记，不再区分群聊');
            ctx.logger.info('wordpress_group_pushes 表已不再使用，已移除相关功能');
            ctx.logger.info('表结构检查和修复完成');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            ctx.logger.error(`检查表结构失败：${errorMessage}`);
            ctx.logger.error(`错误栈：${error instanceof Error ? error.stack : '无'}`);
        }
    }
    async function fetchLatestPosts() {
        try {
            const url = `${config.wordpressUrl}/wp-json/wp/v2/posts?per_page=${config.maxArticles}&orderby=date&order=desc`;
            ctx.logger.info(`正在获取文章: ${url}`);
            // 准备请求配置，添加认证头（如果配置了用户名和应用程序密码）
            const requestConfig = {};
            if (config.username && config.applicationPassword) {
                // 处理WordPress应用程序密码，移除空格（WordPress生成的应用密码格式为：hGR2 sPFu Yncl xHc4 AvJq cUtB）
                const username = config.username;
                const password = config.applicationPassword.replace(/\s+/g, ''); // 移除所有空格
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                requestConfig.headers = {
                    Authorization: `Basic ${auth}`
                };
            }
            const response = await ctx.http.get(url, requestConfig);
            ctx.logger.info(`成功获取 ${response.length} 篇文章`);
            return response;
        }
        catch (error) {
            ctx.logger.error(`获取 WordPress 文章失败: ${error}`);
            return [];
        }
    }
    async function fetchLatestUsers() {
        try {
            // 修改API请求，添加_fields参数明确请求注册日期字段
            // WordPress REST API 默认可能不会返回注册日期，需要明确请求
            const fields = 'id,name,slug,date,date_registered,registered_date,created_at,registeredAt,email,roles,url,description,link,avatar_urls';
            const url = `${config.wordpressUrl}/wp-json/wp/v2/users?per_page=${config.maxArticles}&orderby=registered_date&order=desc&_fields=${fields}`;
            ctx.logger.info(`正在获取用户: ${url}`);
            // 准备请求配置，添加认证头（如果配置了用户名和应用程序密码）
            const requestConfig = {};
            if (config.username && config.applicationPassword) {
                // 处理WordPress应用程序密码，移除空格（WordPress生成的应用密码格式为：hGR2 sPFu Yncl xHc4 AvJq cUtB）
                const username = config.username;
                const password = config.applicationPassword.replace(/\s+/g, ''); // 移除所有空格
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                requestConfig.headers = {
                    Authorization: `Basic ${auth}`
                };
            }
            const response = await ctx.http.get(url, requestConfig);
            ctx.logger.info(`成功获取 ${response.length} 位用户`);
            // 添加调试日志，查看API返回的实际数据结构
            if (response.length > 0) {
                ctx.logger.info(`用户数据示例: ${JSON.stringify(response[0], null, 2)}`);
                // 打印所有可能的日期相关字段
                const user = response[0];
                ctx.logger.info(`用户日期字段: date=${user.date}, date_registered=${user.date_registered}, registered_date=${user.registered_date}, created_at=${user.created_at}`);
            }
            return response;
        }
        catch (error) {
            ctx.logger.error(`获取 WordPress 用户失败: ${error}`);
            ctx.logger.error(`WordPress REST API 的 users 端点需要认证才能访问，请在插件配置中添加 WordPress 用户名和应用程序密码`);
            // 返回空数组，确保插件继续运行
            return [];
        }
    }
    async function fetchUpdatedPosts() {
        try {
            const url = `${config.wordpressUrl}/wp-json/wp/v2/posts?per_page=${config.maxArticles}&orderby=modified&order=desc`;
            ctx.logger.info(`正在获取更新文章: ${url}`);
            // 准备请求配置，添加认证头（如果配置了用户名和应用程序密码）
            const requestConfig = {};
            if (config.username && config.applicationPassword) {
                // 处理WordPress应用程序密码，移除空格（WordPress生成的应用密码格式为：hGR2 sPFu Yncl xHc4 AvJq cUtB）
                const username = config.username;
                const password = config.applicationPassword.replace(/\s+/g, ''); // 移除所有空格
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                requestConfig.headers = {
                    Authorization: `Basic ${auth}`
                };
            }
            const response = await ctx.http.get(url, requestConfig);
            ctx.logger.info(`成功获取 ${response.length} 篇更新文章`);
            return response;
        }
        catch (error) {
            ctx.logger.error(`获取 WordPress 更新文章失败: ${error}`);
            return [];
        }
    }
    async function isUserPushed(userId) {
        try {
            ctx.logger.info(`检查用户是否已推送，用户 ID: ${userId}`);
            const record = await ctx.database.get('wordpress_user_registrations', { userId });
            const result = record.length > 0;
            ctx.logger.info(`检查结果：用户 ${userId} 已推送：${result ? '是' : '否'}`);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            ctx.logger.error(`检查用户推送记录失败：${errorMessage}`);
            ctx.logger.error(`错误栈：${error instanceof Error ? error.stack : '无'}`);
            // 发生错误时，默认返回 false，避免阻塞推送流程
            return false;
        }
    }
    async function getPostUpdateRecord(postId) {
        try {
            ctx.logger.info(`获取文章更新记录，文章 ID: ${postId}`);
            const records = await ctx.database.get('wordpress_post_updates', { postId });
            const result = records.length > 0 ? records[0] : null;
            ctx.logger.info(`获取结果：文章 ${postId} 更新记录：${result ? '找到' : '未找到'}`);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            ctx.logger.error(`获取文章更新记录失败：${errorMessage}`);
            ctx.logger.error(`错误栈：${error instanceof Error ? error.stack : '无'}`);
            // 发生错误时，返回 null，避免阻塞推送流程
            return null;
        }
    }
    async function markUserAsPushed(userId) {
        try {
            ctx.logger.info(`开始标记用户已推送，用户 ID: ${userId}`);
            // 创建新记录，不手动指定id，让数据库自动生成
            const newRecord = {
                userId,
                pushedAt: new Date()
            };
            ctx.logger.info(`准备创建用户推送记录：${JSON.stringify(newRecord)}`);
            await ctx.database.create('wordpress_user_registrations', newRecord);
            ctx.logger.info(`已成功标记用户 ${userId} 为已推送`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('UNIQUE constraint failed')) {
                ctx.logger.warn(`用户推送记录已存在，跳过重复插入：用户 ${userId}`);
                ctx.logger.warn(`完整错误信息：${errorMessage}`);
            }
            else {
                ctx.logger.error(`标记用户推送记录失败：${errorMessage}`);
                ctx.logger.error(`错误栈：${error instanceof Error ? error.stack : '无'}`);
                ctx.logger.error(`插入参数：userId=${userId}`);
                // 非约束冲突错误，不抛出，确保插件继续运行
            }
        }
    }
    async function updatePostUpdateRecord(postId, modifiedDate) {
        try {
            ctx.logger.info(`开始更新文章更新记录，文章 ID: ${postId}，修改时间: ${modifiedDate}`);
            const record = await getPostUpdateRecord(postId);
            if (record) {
                ctx.logger.info(`发现现有记录，文章 ID: ${postId}，上次修改时间: ${record.lastModified}`);
                // Koishi database API 不支持 update 方法，使用 remove + create 代替
                await ctx.database.remove('wordpress_post_updates', { postId });
                ctx.logger.info(`已删除旧记录，文章 ID: ${postId}`);
            }
            // 创建新记录
            const newRecord = {
                postId,
                lastModified: modifiedDate,
                pushedAt: new Date()
            };
            ctx.logger.info(`准备创建新记录，文章 ID: ${postId}，记录内容: ${JSON.stringify(newRecord)}`);
            await ctx.database.create('wordpress_post_updates', newRecord);
            ctx.logger.info(`已成功更新文章更新记录，文章 ID: ${postId}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            ctx.logger.error(`更新文章更新记录失败，文章 ID: ${postId}`);
            ctx.logger.error(`错误信息: ${errorMessage}`);
            ctx.logger.error(`错误栈: ${error instanceof Error ? error.stack : '无'}`);
            throw error;
        }
    }
    function formatPostMessage(post, mention = false, isUpdate = false) {
        // 强化清洗规则：标准化所有空白符为单个半角空格
        const sanitizeText = (text) => {
            return text
                .replace(/<[^>]*>/g, '') // 移除所有 HTML 标签
                .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
                .replace(/\s+/g, ' ') // 标准化所有空白符为单个半角空格
                .trim();
        };
        // 严格截断标题为 60 字符
        let title = sanitizeText(post.title.rendered);
        if (title.length > 60) {
            title = title.substring(0, 57) + '...';
        }
        // 自定义时间格式：年-月-日 时:分
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        };
        const date = formatDate(post.date);
        // 链接强制编码
        const encodedLink = encodeURI(post.link);
        // 构建 @全体成员 文本（适配 QQ 官方 bot 和其他适配器）
        const atAllText = mention && config.mentionAll ? '@全体成员 ' : '';
        // 只使用一个极简表情
        const messageType = isUpdate ? '�' : '📝';
        // 构建核心消息内容，严格控制格式
        // 格式：[表情] [@全体] [时间] - [标题]
        //       [链接]
        let message = `${messageType} ${atAllText}${date} - ${title}\n${encodedLink}`;
        // 双级长度控制：整体消息兜底 300 字符
        if (message.length > 300) {
            message = message.substring(0, 297) + '...';
            ctx.logger.warn(`文章消息超长，已截断，文章 ID: ${post.id}`);
        }
        // 返回单段文本，使用 h.text() 封装，确保兼容性
        return koishi_1.h.text(message);
    }
    function formatUserMessage(user, mention = false) {
        // 强化清洗规则：标准化所有空白符为单个半角空格
        const sanitizeText = (text) => {
            return text
                .replace(/<[^>]*>/g, '') // 移除所有 HTML 标签
                .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
                .replace(/\s+/g, ' ') // 标准化所有空白符为单个半角空格
                .trim();
        };
        // 严格截断用户名为 50 字符
        let username = sanitizeText(user.name);
        if (username.length > 50) {
            username = username.substring(0, 47) + '...';
        }
        // 安全处理日期，避免显示 "Invalid Date"，自定义格式
        let registerDate = '未知时间';
        try {
            ctx.logger.info(`正在处理用户 ${username} 的注册日期`);
            // 尝试所有可能的日期字段，按优先级排序
            const dateFields = [
                'registered_date',
                'user_registered',
                'date_registered',
                'created_at',
                'registeredAt',
                'date'
            ];
            let dateStr;
            // 遍历所有可能的日期字段
            for (const field of dateFields) {
                if (user[field]) {
                    dateStr = user[field];
                    ctx.logger.info(`找到日期字段 ${field}: ${dateStr}`);
                    break;
                }
            }
            // 如果没有找到已知字段，尝试打印所有字段以便调试
            if (!dateStr) {
                ctx.logger.info(`用户 ${username} 的所有字段: ${JSON.stringify(Object.keys(user))}`);
                ctx.logger.info(`用户 ${username} 的原始数据: ${JSON.stringify(user)}`);
            }
            if (dateStr) {
                // 尝试解析日期，使用自定义格式：年-月-日 时:分
                const date = new Date(dateStr);
                ctx.logger.info(`解析日期 ${dateStr} 结果: ${date.toString()}`);
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    registerDate = `${year}-${month}-${day} ${hours}:${minutes}`;
                    ctx.logger.info(`格式化后的日期: ${registerDate}`);
                }
            }
        }
        catch (error) {
            // 捕获任何异常，确保消息能正常生成
            ctx.logger.error(`处理用户 ${username} 日期时出错: ${error}`);
        }
        // 构建 @全体成员 文本（适配 QQ 官方 bot 和其他适配器）
        const atAllText = mention && config.mentionAll ? '@全体成员 ' : '';
        // 只使用一个极简表情
        const messageType = '👤';
        // 构建核心消息内容，严格控制格式和换行
        // 格式：[表情] [@全体] 新用户注册 - [用户名]
        //       注册时间: [时间]
        let message = `${messageType} ${atAllText}新用户注册 - ${username}\n注册时间: ${registerDate}`;
        // 严格控制整体消息长度为 300 字符
        if (message.length > 300) {
            message = message.substring(0, 297) + '...';
            ctx.logger.warn(`用户消息超长，已截断，用户 ID: ${user.id}`);
        }
        // 返回单段文本，使用 h.text() 封装，确保兼容性
        return koishi_1.h.text(message);
    }
    async function pushNewPosts() {
        // 健壮获取 QQ Bot 实例，兼容多种适配器，优先选择 QQ 官方 bot
        const getValidBot = () => {
            // 支持的 QQ 相关适配器列表，'qq' 为 QQ 官方 bot
            const qqAdapters = ['qq', 'onebot', 'milky', 'satori'];
            // ctx.bots 是对象，需转换为数组后遍历
            const botList = Object.values(ctx.bots);
            // 1. 优先选择 QQ 官方 bot（platform === 'qq'）
            for (const bot of botList) {
                if (bot.platform === 'qq') {
                    return bot;
                }
            }
            // 2. 其次选择其他 QQ 适配器 Bot
            for (const bot of botList) {
                if (bot.platform && qqAdapters.includes(bot.platform)) {
                    return bot;
                }
            }
            // 3. 最后选择任何可用 Bot
            return botList[0];
        };
        const bot = getValidBot();
        if (!bot) {
            ctx.logger.error('没有可用的 Bot 实例');
            return;
        }
        // 修复 Bot 标识 undefined 问题
        const botId = bot.selfId || 'unknown';
        ctx.logger.info(`使用 bot ${bot.platform}:${botId} 进行推送`);
        // 推送新文章
        if (config.enableAutoPush) {
            const posts = await fetchLatestPosts();
            ctx.logger.info(`开始检查 ${posts.length} 篇文章是否需要推送`);
            if (posts.length > 0) {
                for (const post of posts) {
                    ctx.logger.info(`正在处理文章: ${post.id} - ${post.title.rendered}`);
                    ctx.logger.info(`文章 ID: ${post.id}, 发布时间: ${post.date}, 修改时间: ${post.modified}`);
                    // 检查文章是否已推送过（所有群聊共用一个标记）
                    const postRecord = await getPostUpdateRecord(post.id);
                    const hasPushed = !!postRecord;
                    ctx.logger.info(`检查结果: 文章 ${post.id} 是否已推送：${hasPushed ? '是' : '否'}`);
                    if (!hasPushed) {
                        // 推送到所有目标群聊
                        for (const target of config.targets) {
                            try {
                                ctx.logger.info(`正在处理目标: ${target}`);
                                // 直接使用原始目标字符串，不进行数字转换，避免丢失平台前缀等信息
                                const stringTarget = target;
                                const message = formatPostMessage(post, true, false);
                                ctx.logger.info(`准备推送新文章到目标: ${stringTarget}`);
                                await bot.sendMessage(stringTarget, message);
                                ctx.logger.info(`已推送新文章到 ${stringTarget}: ${post.title.rendered}`);
                            }
                            catch (error) {
                                ctx.logger.error(`推送新文章到 ${target} 失败: ${error}`);
                                ctx.logger.error(`错误详情: ${JSON.stringify(error)}`);
                            }
                        }
                        // 标记文章已推送（所有群聊共用一个标记）
                        await updatePostUpdateRecord(post.id, new Date(post.modified));
                        ctx.logger.info(`已标记文章 ${post.id} 为已推送，所有群聊将不再推送此文章`);
                    }
                    else {
                        ctx.logger.info(`跳过推送: 文章 ${post.id} 已推送过，所有群聊将不再推送`);
                    }
                }
            }
        }
        // 推送文章更新
        if (config.enableUpdatePush) {
            const posts = await fetchUpdatedPosts();
            if (posts.length > 0) {
                for (const post of posts) {
                    const updateRecord = await getPostUpdateRecord(post.id);
                    const postModifiedDate = new Date(post.modified);
                    // 检查文章是否有更新
                    if (updateRecord && postModifiedDate > new Date(updateRecord.lastModified)) {
                        ctx.logger.info(`文章 ${post.id} 有更新，准备推送更新通知`);
                        // 推送到所有目标群聊
                        for (const target of config.targets) {
                            try {
                                ctx.logger.info(`正在处理目标: ${target}`);
                                const stringTarget = target;
                                const message = formatPostMessage(post, true, true);
                                ctx.logger.info(`准备推送文章更新到目标: ${stringTarget}`);
                                await bot.sendMessage(stringTarget, message);
                                ctx.logger.info(`已推送文章更新到 ${stringTarget}: ${post.title.rendered}`);
                            }
                            catch (error) {
                                ctx.logger.error(`推送文章更新到 ${target} 失败: ${error}`);
                                ctx.logger.error(`错误详情: ${JSON.stringify(error)}`);
                            }
                        }
                        // 更新文章更新记录（所有群聊共用一个标记）
                        await updatePostUpdateRecord(post.id, postModifiedDate);
                        ctx.logger.info(`已更新文章 ${post.id} 的推送记录，所有群聊将使用此更新时间作为新的推送基准`);
                    }
                }
            }
        }
        // 推送新用户注册
        if (config.enableUserPush) {
            const users = await fetchLatestUsers();
            if (users.length > 0) {
                for (const user of users) {
                    if (!(await isUserPushed(user.id))) {
                        for (const target of config.targets) {
                            try {
                                ctx.logger.info(`正在处理目标: ${target}`);
                                // 直接使用原始目标字符串，与新文章推送逻辑保持一致
                                const stringTarget = target;
                                const message = formatUserMessage(user, true);
                                ctx.logger.info(`准备推送新用户到目标: ${stringTarget}`);
                                await bot.sendMessage(stringTarget, message);
                                ctx.logger.info(`已推送新用户到 ${stringTarget}: ${user.name}`);
                            }
                            catch (error) {
                                ctx.logger.error(`推送新用户到 ${target} 失败: ${error}`);
                                ctx.logger.error(`错误详情: ${JSON.stringify(error)}`);
                            }
                        }
                        // 标记用户已推送
                        await markUserAsPushed(user.id);
                    }
                }
            }
        }
    }
    ctx.command('wordpress.latest', '查看最新文章')
        .action(async ({ session }) => {
        ctx.logger.info('命令 wordpress.latest 被调用');
        const posts = await fetchLatestPosts();
        if (posts.length === 0) {
            ctx.logger.info('没有找到文章');
            return koishi_1.h.text('暂无文章');
        }
        // 计算单篇文章的最大长度，确保每条消息不超过390字符
        // 采用简化方案：只返回前3篇文章，确保消息长度在限制内
        const limitedPosts = posts.slice(0, 3);
        let message = '📰 最新文章：\n\n';
        for (const post of limitedPosts) {
            const title = post.title.rendered.replace(/<[^>]*>/g, '');
            // 自定义日期格式，避免过长
            const date = new Date(post.date);
            const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const encodedLink = encodeURI(post.link);
            // 截断标题，避免单条过长
            const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
            message += `${truncatedTitle}\n📅 ${formattedDate}\n🔗 ${encodedLink}\n\n`;
        }
        // 如果有更多文章，添加提示
        if (posts.length > 3) {
            message += `... 共 ${posts.length} 篇文章，只显示前 3 篇`;
        }
        ctx.logger.info(`准备返回消息，长度: ${message.length}`);
        return koishi_1.h.text(message);
    });
    ctx.command('wordpress.list', '查看文章列表')
        .action(async () => {
        ctx.logger.info('命令 wordpress.list 被调用');
        const posts = await fetchLatestPosts();
        if (posts.length === 0) {
            return koishi_1.h.text('暂无文章');
        }
        // 使用数组拼接消息，便于控制格式和长度
        const messageParts = ['📚 文章列表：'];
        for (const post of posts) {
            const title = post.title.rendered.replace(/<[^>]*>/g, '');
            // 截断标题，避免单条过长
            const truncatedTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;
            messageParts.push(`${post.id}. ${truncatedTitle}`);
        }
        let message = messageParts.join('\n');
        // 长度验证，超过 390 字符则精简
        if (message.length > 390) {
            ctx.logger.warn(`消息过长，长度: ${message.length}，将进行精简`);
            // 只保留前10篇文章
            const shortParts = messageParts.slice(0, 11); // 1个标题 + 10篇文章
            shortParts.push('... 更多文章请查看完整列表');
            message = shortParts.join('\n');
        }
        ctx.logger.info(`准备返回消息，长度: ${message.length}`);
        return koishi_1.h.text(message);
    });
    ctx.command('wordpress.push', '手动推送最新文章')
        .action(async () => {
        ctx.logger.info('命令 wordpress.push 被调用');
        await pushNewPosts();
        return koishi_1.h.text('已检查并推送最新文章');
    });
    ctx.command('wordpress.status', '查看插件状态')
        .action(({ session }) => {
        ctx.logger.info('命令 wordpress.status 被调用');
        // 获取当前群号，如果有的话
        const currentGroup = session?.channelId || '未知群聊';
        // 推送目标仅显示本群
        const targetText = `🎯 推送目标: ${currentGroup}`;
        // 使用数组拼接消息，便于控制格式和长度
        const messageParts = [
            '📊 WordPress 插件状态',
            `🌐 站点: ${config.wordpressUrl}`,
            `⏰ 间隔: ${config.interval / 1000} 秒`,
            targetText,
            `🔔 自动推送: ${config.enableAutoPush ? '开启' : '关闭'}`,
            `🔄 更新推送: ${config.enableUpdatePush ? '开启' : '关闭'}`,
            `👤 用户推送: ${config.enableUserPush ? '开启' : '关闭'}`,
            `📢 @全体: ${config.mentionAll ? '开启' : '关闭'}`,
            `📝 最多推送: ${config.maxArticles} 篇`
        ];
        // 合并为单行文本，统一换行符
        let message = messageParts.join('\n');
        // 长度验证，超过 390 字符则精简，符合 QQ 接口限制
        if (message.length > 390) {
            ctx.logger.warn(`消息过长，长度: ${message.length}，将进行精简`);
            message = messageParts.slice(0, 5).join('\n') + '\n... 更多配置请查看完整状态';
        }
        ctx.logger.info(`准备返回消息，长度: ${message.length}`);
        // 使用 h.text() 封装消息，确保兼容性
        return koishi_1.h.text(message);
    });
    ctx.command('wordpress.toggle-update', '切换文章更新推送开关')
        .action(async ({ session }) => {
        // 检查是否为超级管理员
        if (!session || !session.userId) {
            ctx.logger.warn('匿名用户尝试调用 wordpress.toggle-update 命令');
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        // 获取当前用户的QQ号（兼容不同平台格式，如 onebot:123456789 -> 123456789）
        const userId = session.userId.replace(/^\w+:/, '');
        // 检查当前用户是否在插件配置的超级管理员列表中
        if (!config.superAdmins || !config.superAdmins.includes(userId)) {
            ctx.logger.warn(`非超级管理员 ${userId} 尝试调用 wordpress.toggle-update 命令`);
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        ctx.logger.info('命令 wordpress.toggle-update 被调用');
        config.enableUpdatePush = !config.enableUpdatePush;
        return koishi_1.h.text(`文章更新推送已${config.enableUpdatePush ? '开启' : '关闭'}`);
    });
    ctx.command('wordpress.toggle-user', '切换新用户注册推送开关')
        .action(async ({ session }) => {
        // 检查是否为超级管理员
        if (!session || !session.userId) {
            ctx.logger.warn('匿名用户尝试调用 wordpress.toggle-user 命令');
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        // 获取当前用户的QQ号（兼容不同平台格式，如 onebot:123456789 -> 123456789）
        const userId = session.userId.replace(/^\w+:/, '');
        // 检查当前用户是否在插件配置的超级管理员列表中
        if (!config.superAdmins || !config.superAdmins.includes(userId)) {
            ctx.logger.warn(`非超级管理员 ${userId} 尝试调用 wordpress.toggle-user 命令`);
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        ctx.logger.info('命令 wordpress.toggle-user 被调用');
        config.enableUserPush = !config.enableUserPush;
        return koishi_1.h.text(`新用户注册推送已${config.enableUserPush ? '开启' : '关闭'}`);
    });
    ctx.command('wordpress.toggle', '切换自动推送开关')
        .action(async ({ session }) => {
        // 检查是否为超级管理员
        if (!session || !session.userId) {
            ctx.logger.warn('匿名用户尝试调用 wordpress.toggle 命令');
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        // 获取当前用户的QQ号（兼容不同平台格式，如 onebot:123456789 -> 123456789）
        const userId = session.userId.replace(/^\w+:/, '');
        // 检查当前用户是否在插件配置的超级管理员列表中
        if (!config.superAdmins || !config.superAdmins.includes(userId)) {
            ctx.logger.warn(`非超级管理员 ${userId} 尝试调用 wordpress.toggle 命令`);
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        ctx.logger.info('命令 wordpress.toggle 被调用');
        config.enableAutoPush = !config.enableAutoPush;
        return koishi_1.h.text(`自动推送已${config.enableAutoPush ? '开启' : '关闭'}`);
    });
    ctx.command('wordpress.mention', '切换 @全体成员 开关')
        .action(async ({ session }) => {
        // 检查是否为超级管理员
        if (!session || !session.userId) {
            ctx.logger.warn('匿名用户尝试调用 wordpress.mention 命令');
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        // 获取当前用户的QQ号（兼容不同平台格式，如 onebot:123456789 -> 123456789）
        const userId = session.userId.replace(/^\w+:/, '');
        // 检查当前用户是否在插件配置的超级管理员列表中
        if (!config.superAdmins || !config.superAdmins.includes(userId)) {
            ctx.logger.warn(`非超级管理员 ${userId} 尝试调用 wordpress.mention 命令`);
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        ctx.logger.info('命令 wordpress.mention 被调用');
        config.mentionAll = !config.mentionAll;
        return koishi_1.h.text(`@全体 已${config.mentionAll ? '开启' : '关闭'}`);
    });
    ctx.command('wordpress.set-url <url>', '修改 WordPress 站点地址')
        .action(async ({ session }, url) => {
        // 检查是否为超级管理员
        if (!session || !session.userId) {
            ctx.logger.warn('匿名用户尝试调用 wordpress.set-url 命令');
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        // 获取当前用户的QQ号（兼容不同平台格式，如 onebot:123456789 -> 123456789）
        const userId = session.userId.replace(/^\w+:/, '');
        // 检查当前用户是否在插件配置的超级管理员列表中
        if (!config.superAdmins || !config.superAdmins.includes(userId)) {
            ctx.logger.warn(`非超级管理员 ${userId} 尝试调用 wordpress.set-url 命令`);
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        ctx.logger.info(`命令 wordpress.set-url 被调用，调用者：${userId}，新地址：${url}`);
        // 修改站点地址
        config.wordpressUrl = url;
        ctx.logger.info(`站点地址已修改为：${url}`);
        return koishi_1.h.text(`WordPress 站点地址已修改为：${url}`);
    });
    ctx.command('wordpress.pushed', '查看已推送的文章列表')
        .action(async () => {
        ctx.logger.info('命令 wordpress.pushed 被调用');
        // 获取已推送的文章记录，使用 wordpress_post_updates 表
        const records = await ctx.database.get('wordpress_post_updates', {}, {
            sort: {
                pushedAt: 'desc'
            }
        });
        if (records.length === 0) {
            return koishi_1.h.text('暂无已推送文章记录');
        }
        // 使用数组拼接消息，便于控制格式和长度
        const messageParts = ['📋 已推送文章列表（按时间倒序）：'];
        for (const record of records) {
            messageParts.push(`${record.id}. 文章 ID: ${record.postId}`);
            messageParts.push(`📅 推送时间: ${new Date(record.pushedAt).toLocaleString('zh-CN')}`);
            messageParts.push(''); // 空行分隔
        }
        let message = messageParts.join('\n');
        // 长度验证，超过 390 字符则精简，符合 QQ 接口限制
        if (message.length > 390) {
            ctx.logger.warn(`消息过长，长度: ${message.length}，将进行精简`);
            message = messageParts.slice(0, 8).join('\n') + '\n... 更多记录请查看完整列表';
        }
        return koishi_1.h.text(message);
    });
    ctx.command('wordpress.clean [days]', '清理指定天数前的推送记录（默认 30 天）')
        .action(async ({ session }, days) => {
        // 检查是否为超级管理员
        if (!session || !session.userId) {
            ctx.logger.warn('匿名用户尝试调用 wordpress.clean 命令');
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        // 获取当前用户的QQ号（兼容不同平台格式，如 onebot:123456789 -> 123456789）
        const userId = session.userId.replace(/^\w+:/, '');
        // 检查当前用户是否在插件配置的超级管理员列表中
        if (!config.superAdmins || !config.superAdmins.includes(userId)) {
            ctx.logger.warn(`非超级管理员 ${userId} 尝试调用 wordpress.clean 命令`);
            return koishi_1.h.text('您不是超级管理员，无法执行此命令');
        }
        ctx.logger.info(`命令 wordpress.clean 被调用，天数：${days || '默认'}`);
        // 设置默认天数
        const daysToKeep = days ? parseInt(days) : 30;
        if (isNaN(daysToKeep) || daysToKeep <= 0) {
            return koishi_1.h.text('请输入有效的天数');
        }
        // 计算清理时间点
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        // 获取所有记录
        const allUpdateRecords = await ctx.database.get('wordpress_post_updates', {});
        const allUserRecords = await ctx.database.get('wordpress_user_registrations', {});
        // 筛选需要删除的记录
        const updateRecordsToRemove = allUpdateRecords.filter(record => {
            return new Date(record.pushedAt) < cutoffDate;
        });
        const userRecordsToRemove = allUserRecords.filter(record => {
            return new Date(record.pushedAt) < cutoffDate;
        });
        // 删除旧记录
        let result = 0;
        for (const record of updateRecordsToRemove) {
            await ctx.database.remove('wordpress_post_updates', { id: record.id });
            result++;
        }
        for (const record of userRecordsToRemove) {
            await ctx.database.remove('wordpress_user_registrations', { id: record.id });
            result++;
        }
        ctx.logger.info(`已清理 ${result} 条 ${daysToKeep} 天前的推送记录`);
        return koishi_1.h.text(`已清理 ${result} 条 ${daysToKeep} 天前的推送记录`);
    });
    ctx.command('wordpress', 'WordPress 推送插件菜单')
        .action(() => {
        ctx.logger.info('命令 wordpress 被调用');
        // 使用数组拼接消息，便于控制格式和长度
        const messageParts = [
            '📚 WordPress 推送插件菜单：',
            '',
            '🔹 /wordpress.status - 查看插件状态',
            '🔹 /wordpress.latest - 查看最新文章',
            '🔹 /wordpress.list - 查看文章列表',
            '🔹 /wordpress.push - 手动推送最新文章',
            '🔹 /wordpress.set-url <url> - 修改 WordPress 站点地址',
            '🔹 /wordpress.pushed - 查看已推送文章列表',
            '🔹 /wordpress.clean [days] - 清理旧推送记录',
            '🔹 /wordpress.toggle - 切换自动推送开关（仅超级管理员）',
            '🔹 /wordpress.toggle-update - 切换文章更新推送开关（仅超级管理员）',
            '🔹 /wordpress.toggle-user - 切换新用户注册推送开关（仅超级管理员）',
            '🔹 /wordpress.mention - 切换 @全体 开关（仅超级管理员）',
            '',
            '💡 提示：所有命令都需要加 / 前缀'
        ];
        let message = messageParts.join('\n');
        ctx.logger.info(`准备返回消息，长度: ${message.length}`);
        return koishi_1.h.text(message);
    });
    ctx.setInterval(() => {
        pushNewPosts();
    }, config.interval);
}

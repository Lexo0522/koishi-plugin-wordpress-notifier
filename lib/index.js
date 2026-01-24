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
    maxArticles: koishi_1.Schema.number().default(5).description('每次最多推送的文章数量')
});
function apply(ctx, config) {
    ctx.logger.info('WordPress 推送插件已加载');
    ctx.model.extend('wordpress_posts', {
        id: 'integer',
        postId: 'integer',
        pushedAt: 'timestamp'
    }, {
        primary: ['id'],
        autoInc: true
    });
    ctx.model.extend('wordpress_post_updates', {
        id: 'integer',
        postId: 'integer',
        lastModified: 'timestamp',
        pushedAt: 'timestamp'
    }, {
        primary: ['id'],
        autoInc: true,
        unique: ['postId']
    });
    ctx.model.extend('wordpress_user_registrations', {
        id: 'integer',
        userId: 'integer',
        pushedAt: 'timestamp'
    }, {
        primary: ['id'],
        autoInc: true,
        unique: ['userId']
    });
    ctx.model.extend('wordpress_group_pushes', {
        id: 'integer',
        groupId: 'string',
        postId: 'integer',
        pushedAt: 'timestamp',
        isUpdate: 'boolean'
    }, {
        primary: ['id'],
        autoInc: true,
        unique: ['groupId', 'postId']
    });
    async function fetchLatestPosts() {
        try {
            const url = `${config.wordpressUrl}/wp-json/wp/v2/posts?per_page=${config.maxArticles}&orderby=date&order=desc`;
            ctx.logger.info(`正在获取文章: ${url}`);
            const response = await ctx.http.get(url);
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
            const url = `${config.wordpressUrl}/wp-json/wp/v2/users?per_page=${config.maxArticles}&orderby=registered_date&order=desc`;
            ctx.logger.info(`正在获取用户: ${url}`);
            const response = await ctx.http.get(url);
            ctx.logger.info(`成功获取 ${response.length} 位用户`);
            return response;
        }
        catch (error) {
            ctx.logger.error(`获取 WordPress 用户失败: ${error}`);
            return [];
        }
    }
    async function fetchUpdatedPosts() {
        try {
            const url = `${config.wordpressUrl}/wp-json/wp/v2/posts?per_page=${config.maxArticles}&orderby=modified&order=desc`;
            ctx.logger.info(`正在获取更新文章: ${url}`);
            const response = await ctx.http.get(url);
            ctx.logger.info(`成功获取 ${response.length} 篇更新文章`);
            return response;
        }
        catch (error) {
            ctx.logger.error(`获取 WordPress 更新文章失败: ${error}`);
            return [];
        }
    }
    async function isPostPushed(postId) {
        const record = await ctx.database.get('wordpress_posts', { postId });
        return record.length > 0;
    }
    async function isUserPushed(userId) {
        const record = await ctx.database.get('wordpress_user_registrations', { userId });
        return record.length > 0;
    }
    async function getPostUpdateRecord(postId) {
        const records = await ctx.database.get('wordpress_post_updates', { postId });
        return records.length > 0 ? records[0] : null;
    }
    async function isGroupPushed(groupId, postId) {
        const record = await ctx.database.get('wordpress_group_pushes', { groupId, postId });
        return record.length > 0;
    }
    async function markPostAsPushed(postId) {
        await ctx.database.create('wordpress_posts', {
            postId,
            pushedAt: new Date()
        });
    }
    async function markUserAsPushed(userId) {
        await ctx.database.create('wordpress_user_registrations', {
            userId,
            pushedAt: new Date()
        });
    }
    async function updatePostUpdateRecord(postId, modifiedDate) {
        const record = await getPostUpdateRecord(postId);
        if (record) {
            // Koishi database API 不支持 update 方法，使用 remove + create 代替
            await ctx.database.remove('wordpress_post_updates', { postId });
        }
        await ctx.database.create('wordpress_post_updates', {
            postId,
            lastModified: modifiedDate,
            pushedAt: new Date()
        });
    }
    async function markGroupAsPushed(groupId, postId, isUpdate) {
        const record = await ctx.database.get('wordpress_group_pushes', { groupId, postId });
        if (record) {
            // Koishi database API 不支持 update 方法，使用 remove + create 代替
            await ctx.database.remove('wordpress_group_pushes', { groupId, postId });
        }
        await ctx.database.create('wordpress_group_pushes', {
            groupId,
            postId,
            pushedAt: new Date(),
            isUpdate
        });
    }
    function formatPostMessage(post, mention = false, isUpdate = false) {
        // 彻底过滤 HTML 标签和非法字符，只保留安全文本
        const sanitizeText = (text) => {
            return text
                .replace(/<[^>]*>/g, '') // 移除所有 HTML 标签
                .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
                .replace(/[\s\r\n]+/g, ' ') // 标准化空白字符
                .trim();
        };
        const title = sanitizeText(post.title.rendered);
        const excerpt = sanitizeText(post.excerpt.rendered).substring(0, 100);
        const date = new Date(post.date).toLocaleString('zh-CN');
        const modifiedDate = new Date(post.modified).toLocaleString('zh-CN');
        const segments = [];
        if (mention && config.mentionAll) {
            segments.push(koishi_1.h.at('all'));
        }
        // 合并为单段文本，提升适配器兼容性
        const messageType = isUpdate ? '📝 文章更新' : '📝 新文章';
        const messageDate = isUpdate ? `📅 发布: ${date}\n� 更新: ${modifiedDate}` : `� ${date}`;
        const message = `${messageType}\n${messageDate}\n📄 ${excerpt}...\n🔗 ${post.link}`;
        segments.push(koishi_1.h.text(message));
        return segments;
    }
    function formatUserMessage(user, mention = false) {
        // 彻底过滤 HTML 标签和非法字符，只保留安全文本
        const sanitizeText = (text) => {
            return text
                .replace(/<[^>]*>/g, '') // 移除所有 HTML 标签
                .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
                .replace(/[\s\r\n]+/g, ' ') // 标准化空白字符
                .trim();
        };
        const username = sanitizeText(user.name);
        const registerDate = new Date(user.date).toLocaleString('zh-CN');
        const segments = [];
        if (mention && config.mentionAll) {
            segments.push(koishi_1.h.at('all'));
        }
        // 合并为单段文本，提升适配器兼容性
        const message = `👤 新用户注册\n📛 用户名: ${username}\n📅 注册时间: ${registerDate}`;
        segments.push(koishi_1.h.text(message));
        return segments;
    }
    async function pushNewPosts() {
        // 健壮获取 QQ Bot 实例，兼容多种适配器
        const getValidBot = () => {
            // 支持的 QQ 相关适配器列表
            const qqAdapters = ['qq', 'onebot', 'milky', 'satori'];
            // ctx.bots 是对象，需转换为数组后遍历
            const botList = Object.values(ctx.bots);
            // 优先选择活跃的 QQ 适配器 Bot
            for (const bot of botList) {
                if (bot.platform && qqAdapters.includes(bot.platform)) {
                    return bot;
                }
            }
            // 退而求其次，返回第一个可用 Bot
            return botList[0];
        };
        const bot = getValidBot();
        if (!bot) {
            ctx.logger.error('没有可用的 Bot 实例');
            return;
        }
        ctx.logger.info(`使用 bot ${bot.platform}:${bot.selfId} 进行推送`);
        // 推送新文章
        if (config.enableAutoPush) {
            const posts = await fetchLatestPosts();
            if (posts.length > 0) {
                for (const post of posts) {
                    for (const target of config.targets) {
                        try {
                            // 验证目标格式，确保是有效的数字字符串
                            const numericTarget = Number(target);
                            if (isNaN(numericTarget)) {
                                ctx.logger.error(`无效的目标 ${target}，必须是数字类型`);
                                continue;
                            }
                            // 保持字符串类型，但确保内容是有效的数字格式
                            const stringTarget = numericTarget.toString();
                            // 检查该群是否已推送过此文章
                            if (!(await isGroupPushed(stringTarget, post.id))) {
                                const segments = formatPostMessage(post, true, false);
                                ctx.logger.info(`准备推送新文章到目标: ${stringTarget}`);
                                await bot.sendMessage(stringTarget, segments);
                                ctx.logger.info(`已推送新文章到 ${stringTarget}: ${post.title.rendered}`);
                                // 标记该群已推送此文章
                                await markGroupAsPushed(stringTarget, post.id, false);
                            }
                        }
                        catch (error) {
                            ctx.logger.error(`推送新文章到 ${target} 失败: ${error}`);
                            ctx.logger.error(`错误详情: ${JSON.stringify(error)}`);
                        }
                    }
                    // 标记文章已推送（全局记录）
                    if (!(await isPostPushed(post.id))) {
                        await markPostAsPushed(post.id);
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
                    if (!updateRecord || postModifiedDate > new Date(updateRecord.lastModified)) {
                        for (const target of config.targets) {
                            try {
                                // 验证目标格式，确保是有效的数字字符串
                                const numericTarget = Number(target);
                                if (isNaN(numericTarget)) {
                                    ctx.logger.error(`无效的目标 ${target}，必须是数字类型`);
                                    continue;
                                }
                                // 保持字符串类型，但确保内容是有效的数字格式
                                const stringTarget = numericTarget.toString();
                                // 检查该群是否已推送过此文章
                                if (await isGroupPushed(stringTarget, post.id)) {
                                    const segments = formatPostMessage(post, true, true);
                                    ctx.logger.info(`准备推送文章更新到目标: ${stringTarget}`);
                                    await bot.sendMessage(stringTarget, segments);
                                    ctx.logger.info(`已推送文章更新到 ${stringTarget}: ${post.title.rendered}`);
                                    // 更新该群推送记录
                                    await markGroupAsPushed(stringTarget, post.id, true);
                                }
                            }
                            catch (error) {
                                ctx.logger.error(`推送文章更新到 ${target} 失败: ${error}`);
                                ctx.logger.error(`错误详情: ${JSON.stringify(error)}`);
                            }
                        }
                        // 更新文章更新记录
                        await updatePostUpdateRecord(post.id, postModifiedDate);
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
                                // 验证目标格式，确保是有效的数字字符串
                                const numericTarget = Number(target);
                                if (isNaN(numericTarget)) {
                                    ctx.logger.error(`无效的目标 ${target}，必须是数字类型`);
                                    continue;
                                }
                                // 保持字符串类型，但确保内容是有效的数字格式
                                const stringTarget = numericTarget.toString();
                                const segments = formatUserMessage(user, true);
                                ctx.logger.info(`准备推送新用户到目标: ${stringTarget}`);
                                await bot.sendMessage(stringTarget, segments);
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
        .action(async () => {
        ctx.logger.info('命令 wordpress.latest 被调用');
        const posts = await fetchLatestPosts();
        if (posts.length === 0) {
            ctx.logger.info('没有找到文章');
            return '暂无文章';
        }
        let message = '📰 最新文章：\n\n';
        for (const post of posts) {
            const title = post.title.rendered.replace(/<[^>]*>/g, '');
            const date = new Date(post.date).toLocaleString('zh-CN');
            message += `${title}\n📅 ${date}\n🔗 ${post.link}\n\n`;
        }
        ctx.logger.info(`准备返回消息，长度: ${message.length}`);
        return message;
    });
    ctx.command('wordpress.list', '查看文章列表')
        .action(async () => {
        ctx.logger.info('命令 wordpress.list 被调用');
        const posts = await fetchLatestPosts();
        if (posts.length === 0) {
            return '暂无文章';
        }
        let message = '📚 文章列表：\n\n';
        for (const post of posts) {
            const title = post.title.rendered.replace(/<[^>]*>/g, '');
            message += `${post.id}. ${title}\n`;
        }
        return message;
    });
    ctx.command('wordpress.push', '手动推送最新文章')
        .action(async () => {
        ctx.logger.info('命令 wordpress.push 被调用');
        await pushNewPosts();
        return '已检查并推送最新文章';
    });
    ctx.command('wordpress.status', '查看插件状态')
        .action(({ session }) => {
        ctx.logger.info('命令 wordpress.status 被调用');
        // 获取当前群号，如果有的话
        const currentGroup = session?.channelId || '未知群聊';
        // 推送目标仅显示本群
        const targetText = `🎯 推送目标: ${currentGroup}`;
        return `📊 WordPress 推送插件状态：
🌐 网站地址: ${config.wordpressUrl}
⏰ 检查间隔: ${config.interval / 1000} 秒
${targetText}
🔔 自动推送: ${config.enableAutoPush ? '开启' : '关闭'}
🔄 更新推送: ${config.enableUpdatePush ? '开启' : '关闭'}
👤 用户推送: ${config.enableUserPush ? '开启' : '关闭'}
📢 @全体成员: ${config.mentionAll ? '开启' : '关闭'}
📝 最多推送: ${config.maxArticles} 篇`;
    });
    ctx.command('wordpress.toggle-update', '切换文章更新推送开关')
        .action(async ({ session }) => {
        ctx.logger.info('命令 wordpress.toggle-update 被调用');
        config.enableUpdatePush = !config.enableUpdatePush;
        return `文章更新推送已${config.enableUpdatePush ? '开启' : '关闭'}`;
    });
    ctx.command('wordpress.toggle-user', '切换新用户注册推送开关')
        .action(async ({ session }) => {
        ctx.logger.info('命令 wordpress.toggle-user 被调用');
        config.enableUserPush = !config.enableUserPush;
        return `新用户注册推送已${config.enableUserPush ? '开启' : '关闭'}`;
    });
    ctx.command('wordpress.toggle', '切换自动推送开关')
        .action(async ({ session }) => {
        ctx.logger.info('命令 wordpress.toggle 被调用');
        config.enableAutoPush = !config.enableAutoPush;
        return `自动推送已${config.enableAutoPush ? '开启' : '关闭'}`;
    });
    ctx.command('wordpress.mention', '切换 @全体成员 开关')
        .action(async ({ session }) => {
        ctx.logger.info('命令 wordpress.mention 被调用');
        config.mentionAll = !config.mentionAll;
        return `@全体成员 已${config.mentionAll ? '开启' : '关闭'}`;
    });
    ctx.command('wordpress.set-url <url>', '修改 WordPress 站点地址')
        .action(async ({ session }, url) => {
        const userId = session?.userId || 'unknown';
        ctx.logger.info(`命令 wordpress.set-url 被调用，调用者：${userId}，新地址：${url}`);
        // 修改站点地址
        config.wordpressUrl = url;
        ctx.logger.info(`站点地址已修改为：${url}`);
        return `WordPress 站点地址已修改为：${url}`;
    });
    ctx.command('wordpress.pushed', '查看已推送的文章列表')
        .action(async () => {
        ctx.logger.info('命令 wordpress.pushed 被调用');
        // 获取已推送的文章记录
        const records = await ctx.database.get('wordpress_posts', {}, {
            sort: {
                pushedAt: 'desc'
            }
        });
        if (records.length === 0) {
            return '暂无已推送文章记录';
        }
        let message = '📋 已推送文章列表（按时间倒序）：\n\n';
        for (const record of records) {
            message += `${record.id}. 文章 ID: ${record.postId}\n`;
            message += `📅 推送时间: ${new Date(record.pushedAt).toLocaleString('zh-CN')}\n\n`;
        }
        return message;
    });
    ctx.command('wordpress.clean [days]', '清理指定天数前的推送记录（默认 30 天）')
        .action(async ({ session }, days) => {
        ctx.logger.info(`命令 wordpress.clean 被调用，天数：${days || '默认'}`);
        // 设置默认天数
        const daysToKeep = days ? parseInt(days) : 30;
        if (isNaN(daysToKeep) || daysToKeep <= 0) {
            return '请输入有效的天数';
        }
        // 计算清理时间点
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        // 获取所有记录
        const allRecords = await ctx.database.get('wordpress_posts', {});
        // 筛选需要删除的记录
        const recordsToRemove = allRecords.filter(record => {
            return new Date(record.pushedAt) < cutoffDate;
        });
        // 删除旧记录
        let result = 0;
        for (const record of recordsToRemove) {
            await ctx.database.remove('wordpress_posts', { id: record.id });
            result++;
        }
        ctx.logger.info(`已清理 ${result} 条 ${daysToKeep} 天前的推送记录`);
        return `已清理 ${result} 条 ${daysToKeep} 天前的推送记录`;
    });
    ctx.command('wordpress', 'WordPress 推送插件菜单')
        .action(() => {
        ctx.logger.info('命令 wordpress 被调用');
        return `📚 WordPress 推送插件菜单：

🔹 /wordpress.status - 查看插件状态
🔹 /wordpress.latest - 查看最新文章
🔹 /wordpress.list - 查看文章列表
🔹 /wordpress.push - 手动推送最新文章
🔹 /wordpress.set-url <url> - 修改 WordPress 站点地址
🔹 /wordpress.pushed - 查看已推送文章列表
🔹 /wordpress.clean [days] - 清理旧推送记录
🔹 /wordpress.toggle - 切换自动推送开关
🔹 /wordpress.toggle-update - 切换文章更新推送开关
🔹 /wordpress.toggle-user - 切换新用户注册推送开关
🔹 /wordpress.mention - 切换 @全体成员 开关

💡 提示：所有命令都需要加 / 前缀`;
    });
    ctx.on('ready', async () => {
        ctx.logger.info('WordPress 推送插件已就绪');
        await pushNewPosts();
    });
    ctx.setInterval(() => {
        pushNewPosts();
    }, config.interval);
}

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
    async function fetchUsers() {
        try {
            const url = `${config.wordpressUrl}/wp-json/wp/v2/users`;
            ctx.logger.info(`正在获取用户信息: ${url}`);
            const response = await ctx.http.get(url);
            ctx.logger.info(`成功获取 ${response.length} 个用户`);
            return response;
        }
        catch (error) {
            ctx.logger.error(`获取 WordPress 用户信息失败: ${error}`);
            return [];
        }
    }
    async function fetchUserById(userId) {
        try {
            const url = `${config.wordpressUrl}/wp-json/wp/v2/users/${userId}`;
            ctx.logger.info(`正在获取用户信息: ${url}`);
            const response = await ctx.http.get(url);
            return response;
        }
        catch (error) {
            ctx.logger.error(`获取 WordPress 用户信息失败: ${error}`);
            return null;
        }
    }
    async function isPostPushed(postId) {
        const record = await ctx.database.get('wordpress_posts', { postId });
        return record.length > 0;
    }
    async function markPostAsPushed(postId) {
        await ctx.database.create('wordpress_posts', {
            postId,
            pushedAt: new Date()
        });
    }
    function formatPostMessage(post, mention = false) {
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
        const segments = [];
        if (mention && config.mentionAll) {
            segments.push(koishi_1.h.at('all'));
        }
        // 合并为单段文本，提升适配器兼容性
        const message = `📝 ${title}\n📅 ${date}\n📄 ${excerpt}...\n🔗 ${post.link}`;
        segments.push(koishi_1.h.text(message));
        return segments;
    }
    async function pushNewPosts() {
        if (!config.enableAutoPush) {
            ctx.logger.info('自动推送已关闭，跳过推送');
            return;
        }
        const posts = await fetchLatestPosts();
        if (posts.length === 0) {
            ctx.logger.info('没有获取到新文章，跳过推送');
            return;
        }
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
        for (const post of posts) {
            if (!(await isPostPushed(post.id))) {
                const segments = formatPostMessage(post, true);
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
                        ctx.logger.info(`准备推送文章到目标: ${stringTarget}`);
                        // 使用标准 Segment 构造兼容消息，支持多种适配器
                        await bot.sendMessage(stringTarget, segments);
                        ctx.logger.info(`已推送文章到 ${stringTarget}: ${post.title.rendered}`);
                    }
                    catch (error) {
                        ctx.logger.error(`推送文章到 ${target} 失败: ${error}`);
                        ctx.logger.error(`错误详情: ${JSON.stringify(error)}`);
                    }
                }
                await markPostAsPushed(post.id);
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
    ctx.command('wordpress.users', '查看站点用户列表')
        .action(async () => {
        ctx.logger.info('命令 wordpress.users 被调用');
        const users = await fetchUsers();
        if (users.length === 0) {
            return '暂无用户信息';
        }
        let message = '👥 WordPress 站点用户列表：\n\n';
        for (const user of users) {
            const roles = user.roles || [];
            message += `${user.id}. ${user.name}（${roles.join(', ') || '普通用户'}）\n`;
            message += `🔗 ${user.link}\n\n`;
        }
        return message;
    });
    ctx.command('wordpress.user <id>', '查看特定用户信息')
        .action(async ({}, userId) => {
        ctx.logger.info(`命令 wordpress.user 被调用，用户 ID：${userId}`);
        const id = parseInt(userId);
        if (isNaN(id)) {
            return '请输入有效的用户 ID';
        }
        const user = await fetchUserById(id);
        if (!user) {
            return `未找到 ID 为 ${id} 的用户`;
        }
        let message = `👤 用户信息：\n\n`;
        message += `ID: ${user.id}\n`;
        message += `昵称: ${user.name}\n`;
        message += `个人主页: ${user.link}\n`;
        if (user.description) {
            message += `简介: ${user.description.replace(/<[^>]*>/g, '')}\n`;
        }
        if (user.registered_date) {
            message += `注册时间: ${new Date(user.registered_date).toLocaleString('zh-CN')}\n`;
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
        .action(() => {
        ctx.logger.info('命令 wordpress.status 被调用');
        return `📊 WordPress 推送插件状态：
🌐 网站地址: ${config.wordpressUrl}
⏰ 检查间隔: ${config.interval / 1000} 秒
🎯 推送目标: ${config.targets.join(', ')}
🔔 自动推送: ${config.enableAutoPush ? '开启' : '关闭'}
📢 @全体成员: ${config.mentionAll ? '开启' : '关闭'}
📝 最多推送: ${config.maxArticles} 篇`;
    });
    ctx.command('wordpress.toggle', '切换自动推送开关')
        .action(async () => {
        ctx.logger.info('命令 wordpress.toggle 被调用');
        config.enableAutoPush = !config.enableAutoPush;
        return `自动推送已${config.enableAutoPush ? '开启' : '关闭'}`;
    });
    ctx.command('wordpress.mention', '切换 @全体成员 开关')
        .action(async () => {
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
🔹 /wordpress.users - 查看站点用户列表
🔹 /wordpress.user <id> - 查看特定用户信息
🔹 /wordpress.push - 手动推送最新文章
🔹 /wordpress.set-url <url> - 修改 WordPress 站点地址
🔹 /wordpress.pushed - 查看已推送文章列表
🔹 /wordpress.clean [days] - 清理旧推送记录
🔹 /wordpress.toggle - 切换自动推送开关
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

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
    maxArticles: koishi_1.Schema.number().default(5).description('每次最多推送的文章数量'),
    superAdmins: koishi_1.Schema.array(koishi_1.Schema.string()).default([]).description('超级管理员列表（QQ 号）')
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
            id: postId,
            postId,
            pushedAt: new Date()
        });
    }
    function formatPostMessage(post, mention = false) {
        const title = post.title.rendered.replace(/<[^>]*>/g, '');
        const excerpt = post.excerpt.rendered.replace(/<[^>]*>/g, '').substring(0, 100);
        const date = new Date(post.date).toLocaleString('zh-CN');
        let message = '';
        if (mention && config.mentionAll) {
            message += '@全体成员\n';
        }
        message += `📝 ${title}\n`;
        message += `📅 ${date}\n`;
        message += `📄 ${excerpt}...\n`;
        message += `🔗 ${post.link}`;
        return message;
    }
    async function pushNewPosts() {
        if (!config.enableAutoPush)
            return;
        const posts = await fetchLatestPosts();
        if (posts.length === 0)
            return;
        for (const post of posts) {
            if (!(await isPostPushed(post.id))) {
                const message = formatPostMessage(post, true);
                for (const target of config.targets) {
                    try {
                        const bot = ctx.bots[0];
                        if (bot) {
                            await bot.sendMessage(target, message);
                            ctx.logger.info(`已推送文章到 ${target}: ${post.title.rendered}`);
                        }
                        else {
                            ctx.logger.error(`没有可用的 bot 实例`);
                        }
                    }
                    catch (error) {
                        ctx.logger.error(`推送文章到 ${target} 失败: ${error}`);
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
            message += `${user.id}. ${user.name}\n`;
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
    ctx.command('wordpress.set-url <url>', '修改 WordPress 站点地址（仅超级管理员可用）')
        .action(async ({ session }, url) => {
        const userId = session?.userId || 'unknown';
        ctx.logger.info(`命令 wordpress.set-url 被调用，调用者：${userId}，新地址：${url}`);
        // 检查是否为超级管理员
        if (!session?.userId || !config.superAdmins.includes(session.userId)) {
            ctx.logger.warn(`用户 ${userId} 尝试修改站点地址，但不是超级管理员`);
            return '你没有权限执行此命令';
        }
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
        // 检查是否为超级管理员
        const userId = session?.userId || 'unknown';
        if (!session?.userId || !config.superAdmins.includes(session.userId)) {
            ctx.logger.warn(`用户 ${userId} 尝试清理记录，但不是超级管理员`);
            return '你没有权限执行此命令';
        }
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

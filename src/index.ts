import { Context, Schema, h } from 'koishi'
export const inject = ['database', 'http']
export const name = 'wordpress-notifier'

declare module 'koishi' {
  interface Tables {
    wordpress_posts: WordPressPostRecord
  }
}

export interface Config {
  wordpressUrl: string
  interval: number
  targets: string[]
  enableAutoPush: boolean
  mentionAll: boolean
  maxArticles: number
}

export interface WordPressPost {
  id: number
  title: {
    rendered: string
  }
  link: string
  date: string
  excerpt: {
    rendered: string
  }
  author: number
  categories: number[]
  tags: number[]
}

export interface WordPressPostRecord {
  id: number
  postId: number
  pushedAt: Date
}

export const Config: Schema<Config> = Schema.object({
  wordpressUrl: Schema.string().description('WordPress 网站地址（例如：https://example.com）'),
  interval: Schema.number().default(3600000).description('检查间隔（毫秒，默认 1 小时）'),
  targets: Schema.array(Schema.string()).description('推送目标（群号或 QQ 号）'),
  enableAutoPush: Schema.boolean().default(true).description('是否启用自动推送'),
  mentionAll: Schema.boolean().default(false).description('是否 @全体成员'),
  maxArticles: Schema.number().default(5).description('每次最多推送的文章数量')
})

export function apply(ctx: Context, config: Config) {
  ctx.logger.info('WordPress 推送插件已加载')

  ctx.model.extend('wordpress_posts', {
    id: 'integer',
    postId: 'integer',
    pushedAt: 'timestamp'
  })

  async function fetchLatestPosts(): Promise<WordPressPost[]> {
    try {
      const url = `${config.wordpressUrl}/wp-json/wp/v2/posts?per_page=${config.maxArticles}&orderby=date&order=desc`
      ctx.logger.info(`正在获取文章: ${url}`)
      const response = await ctx.http.get<WordPressPost[]>(url)
      ctx.logger.info(`成功获取 ${response.length} 篇文章`)
      return response
    } catch (error) {
      ctx.logger.error(`获取 WordPress 文章失败: ${error}`)
      return []
    }
  }

  async function isPostPushed(postId: number): Promise<boolean> {
    const record = await ctx.database.get('wordpress_posts', { postId })
    return record.length > 0
  }

  async function markPostAsPushed(postId: number) {
    await ctx.database.create('wordpress_posts', {
      id: postId,
      postId,
      pushedAt: new Date()
    })
  }

  function formatPostMessage(post: WordPressPost, mention: boolean = false): string {
    const title = post.title.rendered.replace(/<[^>]*>/g, '')
    const excerpt = post.excerpt.rendered.replace(/<[^>]*>/g, '').substring(0, 100)
    const date = new Date(post.date).toLocaleString('zh-CN')
    
    let message = ''
    if (mention && config.mentionAll) {
      message += '@全体成员\n'
    }
    message += `📝 ${title}\n`
    message += `📅 ${date}\n`
    message += `📄 ${excerpt}...\n`
    message += `🔗 ${post.link}`
    
    return message
  }

  async function pushNewPosts() {
    if (!config.enableAutoPush) return

    const posts = await fetchLatestPosts()
    if (posts.length === 0) return

    for (const post of posts) {
      if (!(await isPostPushed(post.id))) {
        const message = formatPostMessage(post, true)
        
        for (const target of config.targets) {
          try {
            const bot = ctx.bots[0]
            if (bot) {
              await bot.sendMessage(target, message)
              ctx.logger.info(`已推送文章到 ${target}: ${post.title.rendered}`)
            } else {
              ctx.logger.error(`没有可用的 bot 实例`)
            }
          } catch (error) {
            ctx.logger.error(`推送文章到 ${target} 失败: ${error}`)
          }
        }
        
        await markPostAsPushed(post.id)
      }
    }
  }

  ctx.command('wordpress.latest', '查看最新文章')
    .action(async () => {
      ctx.logger.info('命令 wordpress.latest 被调用')
      const posts = await fetchLatestPosts()
      if (posts.length === 0) {
        ctx.logger.info('没有找到文章')
        return '暂无文章'
      }
      
      let message = '📰 最新文章：\n\n'
      for (const post of posts) {
        const title = post.title.rendered.replace(/<[^>]*>/g, '')
        const date = new Date(post.date).toLocaleString('zh-CN')
        message += `${title}\n📅 ${date}\n🔗 ${post.link}\n\n`
      }
      
      ctx.logger.info(`准备返回消息，长度: ${message.length}`)
      return message
    })

  ctx.command('wordpress.list', '查看文章列表')
    .action(async () => {
      ctx.logger.info('命令 wordpress.list 被调用')
      const posts = await fetchLatestPosts()
      if (posts.length === 0) {
        return '暂无文章'
      }
      
      let message = '📚 文章列表：\n\n'
      for (const post of posts) {
        const title = post.title.rendered.replace(/<[^>]*>/g, '')
        message += `${post.id}. ${title}\n`
      }
      
      return message
    })

  ctx.command('wordpress.push', '手动推送最新文章')
    .action(async () => {
      ctx.logger.info('命令 wordpress.push 被调用')
      await pushNewPosts()
      return '已检查并推送最新文章'
    })

  ctx.command('wordpress.status', '查看插件状态')
    .action(() => {
      ctx.logger.info('命令 wordpress.status 被调用')
      return `📊 WordPress 推送插件状态：
🌐 网站地址: ${config.wordpressUrl}
⏰ 检查间隔: ${config.interval / 1000} 秒
🎯 推送目标: ${config.targets.join(', ')}
🔔 自动推送: ${config.enableAutoPush ? '开启' : '关闭'}
📢 @全体成员: ${config.mentionAll ? '开启' : '关闭'}
📝 最多推送: ${config.maxArticles} 篇`
    })

  ctx.command('wordpress.toggle', '切换自动推送开关')
    .action(async () => {
      ctx.logger.info('命令 wordpress.toggle 被调用')
      config.enableAutoPush = !config.enableAutoPush
      return `自动推送已${config.enableAutoPush ? '开启' : '关闭'}`
    })

  ctx.command('wordpress.mention', '切换 @全体成员 开关')
    .action(async () => {
      ctx.logger.info('命令 wordpress.mention 被调用')
      config.mentionAll = !config.mentionAll
      return `@全体成员 已${config.mentionAll ? '开启' : '关闭'}`
    })

  ctx.command('wordpress', 'WordPress 推送插件菜单')
    .action(() => {
      ctx.logger.info('命令 wordpress 被调用')
      return `📚 WordPress 推送插件菜单：

🔹 /wordpress.status - 查看插件状态
🔹 /wordpress.latest - 查看最新文章
🔹 /wordpress.list - 查看文章列表
🔹 /wordpress.push - 手动推送最新文章
🔹 /wordpress.toggle - 切换自动推送开关
🔹 /wordpress.mention - 切换 @全体成员 开关

💡 提示：所有命令都需要加 / 前缀`
    })

  ctx.on('ready', async () => {
    ctx.logger.info('WordPress 推送插件已就绪')
    await pushNewPosts()
  })

  ctx.setInterval(() => {
    pushNewPosts()
  }, config.interval)
}

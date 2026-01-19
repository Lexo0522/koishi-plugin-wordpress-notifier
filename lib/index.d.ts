import { Context, Schema } from 'koishi';
export declare const inject: string[];
export declare const name = "wordpress-notifier";
declare module 'koishi' {
    interface Tables {
        wordpress_posts: WordPressPostRecord;
    }
}
export interface Config {
    wordpressUrl: string;
    interval: number;
    targets: string[];
    enableAutoPush: boolean;
    mentionAll: boolean;
    maxArticles: number;
}
export interface WordPressPost {
    id: number;
    title: {
        rendered: string;
    };
    link: string;
    date: string;
    excerpt: {
        rendered: string;
    };
    author: number;
    categories: number[];
    tags: number[];
}
export interface WordPressUser {
    id: number;
    name: string;
    description: string;
    link: string;
    avatar_urls: {
        '24': string;
        '48': string;
        '96': string;
    };
    registered_date: string;
    roles: string[];
}
export interface WordPressPostRecord {
    id: number;
    postId: number;
    pushedAt: Date;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;

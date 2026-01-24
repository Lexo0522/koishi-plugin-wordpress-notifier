import { Context, Schema } from 'koishi';
export declare const inject: string[];
export declare const name = "wordpress-notifier";
declare module 'koishi' {
    interface Tables {
        wordpress_posts: WordPressPostRecord;
        wordpress_post_updates: WordPressPostUpdateRecord;
        wordpress_user_registrations: WordPressUserRegistrationRecord;
        wordpress_group_pushes: WordPressGroupPushRecord;
    }
}
export interface Config {
    wordpressUrl: string;
    interval: number;
    targets: string[];
    enableAutoPush: boolean;
    enableUpdatePush: boolean;
    enableUserPush: boolean;
    mentionAll: boolean;
    maxArticles: number;
    username?: string;
    applicationPassword?: string;
}
export interface WordPressPost {
    id: number;
    title: {
        rendered: string;
    };
    link: string;
    date: string;
    modified: string;
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
    slug: string;
    date?: string;
    date_registered?: string;
    registered_date?: string;
    user_registered?: string;
    created_at?: string;
    registeredAt?: string;
    email: string;
    roles: string[];
    [key: string]: any;
}
export interface WordPressPostRecord {
    id: number;
    postId: number;
    pushedAt: Date;
}
export interface WordPressPostUpdateRecord {
    id: number;
    postId: number;
    lastModified: Date;
    pushedAt: Date;
}
export interface WordPressUserRegistrationRecord {
    id: number;
    userId: number;
    pushedAt: Date;
}
export interface WordPressGroupPushRecord {
    id: number;
    groupId: string;
    postId: number;
    pushedAt: Date;
    isUpdate: boolean;
}
export interface WordPressNotification {
    type: 'post' | 'update' | 'user';
    data: any;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;

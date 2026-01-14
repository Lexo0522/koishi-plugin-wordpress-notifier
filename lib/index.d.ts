import { Context, Schema } from 'koishi';
export declare const name = "wordpress-notifier";
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
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;

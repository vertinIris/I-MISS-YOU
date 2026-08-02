-- migration-018: 清理 comments 表中内容重复的冗余行
--
-- 背景：旧版 mergeComments 对云端评论用 id 去重、对本地无 id 的种子评论用
--       (name+text) 去重，导致同一条种子评论在本地与云端各存一份，并经
--       pullCommentsAndPersist 反复写回 localStorage，形成重复。
--       前端已修复去重逻辑（repository.js mergeComments / dedupeLocalComments），
--       但云端表中可能已残留内容完全相同的多行，需在此清理。
--
-- 作用：按 (target_id, author_name, content) 分组，对每组保留 id 最小的一条，
--       删除其余内容重复的行。幂等：已无重复时本语句不删除任何行。
--
-- 执行方式：在 Supabase Dashboard → SQL Editor 中以「服务角色 / 项目 owner」执行。
--           说明：种子评论 author_id 为 NULL，匿名前端受 RLS 限制无法删除他人评论，
--           故云端种子重复只能由此 SQL（服务权限）完成。前端 dedupeCloudComments()
--           仅能清理当前匿名用户自己 author_id 下的重复。

delete from comments a
using comments b
where a.target_id  = b.target_id
  and a.author_name = b.author_name
  and a.content     = b.content
  and a.id > b.id;

-- 可选：同时清理 submissions 表的内容重复（按 type+name+title+content 分组）
-- 当前版本 submissions 去重键为内容，理论上不会重复，留作保险：
-- delete from submissions a
-- using submissions b
-- where a.type    = b.type
--   and a.name    = b.name
--   and a.title   = b.title
--   and a.content = b.content
--   and a.id > b.id;

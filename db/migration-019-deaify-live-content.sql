-- migration-019: 现网内容按角色人设去 AI 化改写
--
-- 背景：Supabase 现网跑的是 v8.0 之前的旧种子，文本存在明显的 AI 生成痕迹
--       （三段式排比、强行升华的结尾金句、破折号抒情滥用、空洞形容词堆砌），
--       且 35 条匿名评论腔调雷同，读起来像同一个模板套出来的。
--
-- 作用：对 submissions 6 篇（每篇 2 份重复行，共 12 行）与 comments 35 条
--       （作者 = 匿名信号源）按各自角色人设重写文本，降低 AI 痕迹。
--
-- 改写原则：
--   1. 事实锚点零改动 —— 调频9072（无量纲，非 9072Hz）、23:00、0.3秒、
--      三千字设备维护报告、三个小时、听了三天、调了3次频道、紫外线显形、
--      清洁机器人、老式收音机/数字调谐，以及全部地名与角色名原样保留。
--   2. 角色文风分化 —— 漂泊者信使走精简、雅俗共赏；调频9072 技术较真带温度；
--      塞莱斯特画面感与具体笔触；诺娃平实留白；学院路人C 生活化松弛；
--      埃拉拉短诗呼吸感；匿名信号源 35 条彼此腔调各异。
--   3. 评论回应对象（target_id）不变，改写后仍对应同一话题。
--
-- 不在改写范围（禁改区，本文件不触碰）：
--   - id 2375  作者 rt4    —— 测试探针行
--   - id 2463  作者 M      —— 真实用户留言
--   - id 2473  作者 M      —— 真实用户留言
--   - id 2474  作者 砚秋   —— 真实用户留言
--   - id 2477  作者 砚秋   —— 真实用户留言
--
-- 重复行处理：
--   - submissions 6 篇各有 2 份完全重复的行，本文件对两行写入相同改写文本，
--     保持现状不删除。如需去重请另行执行 migration-018 中被注释的 submissions
--     去重语句（去重后每篇只保留 id 较小的一行）。
--   - comments 中 2471/2472/2475/2476 原与 1/2/3/5 内容完全重复，本文件为这
--     四条写入语气不同的另一版本，使站内不再出现内容一致的评论。改写后
--     migration-018 的 content 去重语句不会再误删这四行。
--
-- 执行方式：Supabase Dashboard → SQL Editor，以「服务角色 / 项目 owner」执行。
--           说明：种子行 author_id 为 NULL，anon 角色无对应 UPDATE 策略，
--           前端匿名身份改不动这些行（PATCH 返回 200 但影响 0 行）。
--
-- 幂等性：本文件为按 id 定值覆盖，可重复执行，结果一致。
--
-- 注意：本文件不修改 comments.edited_at 与 submissions.updated_at，
--       避免前端把种子内容显示为「已编辑」。

begin;

-- ============================================================
-- 一、submissions（6 篇 × 2 份重复行 = 12 行）
-- ============================================================

-- [SUB-1] 调频9072 ·《频率使用指南》· 文字
update submissions set content = $deaify$9072这个频率，不是你想调就能调到的。

条件大概是这几个：
① 得是深夜，23:00之后，早了没用
② 老式收音机。数字调谐的那种别试了，我试过，连噪音都收不干净
③ 环境要静，电磁干扰一大，信号直接被压掉
④ 你得信这事儿是真的

第四条听着最玄，但恰恰是最卡人的。不信的人，调一整晚也是空的。$deaify$
where id in (956, 962);

-- [SUB-2] 漂泊者信使 ·《写给星空的回信》· 诗歌
update submissions set content = $deaify$你说，抬头就能找到那颗星。

我抬了。
它在。只是换了个频率。

我们不必在同一个频道。
你发你的，我发我的。
总会有人收到。$deaify$
where id in (957, 961);

-- [SUB-3] 塞莱斯特 ·《双形态素描》· 插画
update submissions set content = $deaify$速写，两张并排。

左边是少女形态。发丝往一边吹，我描了两遍才把那股飘劲儿留住；眼睛里点了星光，其实就是两个高光点，删掉之后整张脸就死了。
右边是机兵形态。外壳走流线，铅笔侧锋压出金属反光，能量核心那块上了淡蓝，是全画唯一一处颜色。

中间那条线本来想画成分界，画着画着改主意了，改成共振线。

不是两个人。是一个人的两种画法。$deaify$
where id in (958, 965);

-- [SUB-4] 诺娃 ·《信号塔守望者》· 故事
update submissions set content = $deaify$在信号塔上等了三个小时。

不是值班。是你说过今晚星星会很亮。

后来灯真的亮了。不是星星，是你在模拟舱里调的天文台投影。

我知道是假的。也看完了。

谢谢。$deaify$
where id in (959, 988);

-- [SUB-5] 学院路人C ·《走廊白噪音》· 音乐
update submissions set content = $deaify$在拉贝尔学部走廊录了段白噪音。脚步声，远处实验室的嗡嗡声，偶尔飘过来半句谁跟谁的对话。

本来是想拿来助眠的，结果听着听着觉得，这玩意儿本身就挺像一首曲子。嗡嗡声在底下垫着，脚步一下一下踩上去，对话是冷不丁冒出来的那种。

不知道飞行雪绒听不听这种。感觉她会喜欢吧。$deaify$
where id in (960, 963);

-- [SUB-6] 埃拉拉 ·《拉贝尔学部的黄昏》· 诗歌
update submissions set content = $deaify$走廊尽头那扇窗
朝西

你每次经过都停一下
用指尖在玻璃上画星

清洁机器人来过了
擦得很干净

我没说话

星还在
在折射里
等下一个黄昏$deaify$
where id in (964, 989);


-- ============================================================
-- 二、comments（35 条，作者均为 匿名信号源）
-- ============================================================

-- target = 1（拉海洛的雪 / 模拟舱飘雪）
update comments set content = $deaify$拉海洛那片雪原是真好看。哪天回去看看真的雪吧，模拟的总差点意思。$deaify$ where id = 1;
update comments set content = $deaify$拉海洛的雪我也记得。脚印那会儿是两串，一直踩到看不见为止。$deaify$ where id = 2;
update comments set content = $deaify$模拟舱那场雪我也去了，是好看。就是我堆的雪人歪成了个信号塔，路过的人都绕着走。$deaify$ where id = 3;
update comments set content = $deaify$等等，模拟舱能下雪？？用了这么久我一次都没翻到过这个功能。明天就去试试。$deaify$ where id = 5;

-- target = 2
update comments set content = $deaify$0.3秒的延迟，这你也数得清。我倒觉得那不是毛病，卡的那一下反而最像你。$deaify$ where id = 4;
update comments set content = $deaify$适格者看到的东西跟别人不一样，这我信。不一样又不等于坏事，你那边热闹多了。$deaify$ where id = 6;
update comments set content = $deaify$频率对不上也没什么。我调了3次频道才收着你的信号，第三次的时候手都要放弃了～$deaify$ where id = 11;

-- target = 3
update comments set content = $deaify$歌单能发我一份吗？天文台那段白噪音我听了三天，赶论文全靠它续命$deaify$ where id = 9;
update comments set content = $deaify$下回歌单里加一首你自己的呗～飞行雪绒的歌单里没有飞行雪绒，说不过去。$deaify$ where id = 12;
update comments set content = $deaify$宇宙一直在说话，只是大部分人频道调错了。你调对了。$deaify$ where id = 14;

-- target = 4
update comments set content = $deaify$三千字设备维护报告？？为了这个写三千字，也是够可以的。不过我觉得值。$deaify$ where id = 8;
update comments set content = $deaify$紫外线下才显形的笑脸，这招确实有意思。不过耗材还是走正规渠道领吧，被抽查到是要写说明的。$deaify$ where id = 10;
update comments set content = $deaify$你总能看见别人看不见的东西。说不羡慕是假的。$deaify$ where id = 13;
update comments set content = $deaify$有些东西就得在黑暗里才看得见。这句抄走了啊$deaify$ where id = 15;

-- target = 5
update comments set content = $deaify$两条时间线叠上的那一下，我好像也撞见过一次。就那一下，感觉离你近了点。$deaify$ where id = 7;
update comments set content = $deaify$少女形态「嗒嗒嗒」，机兵形态「————」。看到这儿我在自习室笑出声，被人回头看。$deaify$ where id = 16;
update comments set content = $deaify$机兵形态也太帅了。下次能给看看吗，我保证不叫。……行吧，可能会叫一声。$deaify$ where id = 18;
update comments set content = $deaify$声波在金属和空气里传得不一样快，这个点我是真没想到。不愧是星炬学院的。$deaify$ where id = 19;

-- target = 6
update comments set content = $deaify$「哪怕只有一秒钟」，这句我翻来覆去想了好几天。一秒是不长，但记一辈子够了。$deaify$ where id = 17;
update comments set content = $deaify$你描的那片星空，比望远镜里的好看。望远镜里没有你。$deaify$ where id = 21;
update comments set content = $deaify$银河信号河。这名字我要了，观测日志的标题就叫这个。$deaify$ where id = 22;
update comments set content = $deaify$数据包发射中。目标：正在读这条的你。内容：一颗星星$deaify$ where id = 23;

-- target = diary-1
update comments set content = $deaify$咖啡机坏了第三天，重点难道不是这个吗。别的都好说，这个真忍不了。$deaify$ where id = 24;
update comments set content = $deaify$你留下的东西会有人收到的。这个我不担心$deaify$ where id = 26;
update comments set content = $deaify$「来自过去的温柔」，看到这句我在食堂差点没绷住。明明是难过的事，被你一写就没那么难过了。$deaify$ where id = 27;

-- target = diary-2
update comments set content = $deaify$零点几秒的转换，你居然记得住那个感觉。下次能录一段吗，我想听听是什么动静。$deaify$ where id = 25;
update comments set content = $deaify$又是少女又是机兵，又是血肉又是金属。这种状态我想象不出来，但听你说着挺好的。$deaify$ where id = 28;
update comments set content = $deaify$「取决于谁在问」。这个回答我服。换我大概只会愣在那儿。$deaify$ where id = 29;

-- target = diary-3
update comments set content = $deaify$走廊尽头那扇窗！我也老在那儿站着看夕阳。合着咱俩摸鱼摸到一块去了。$deaify$ where id = 20;
update comments set content = $deaify$飞行雪绒，这名字好听。比档案上那串编号强多了。以后就这么叫了啊。$deaify$ where id = 30;
update comments set content = $deaify$属于你的时间，你找着了。挺好$deaify$ where id = 31;

-- 原重复行 → 改为语气不同的另一版（target = 1）
update comments set content = $deaify$拉海洛的雪，踩上去咯吱响。脚印留不住多久，风一刮就平了。$deaify$ where id = 2471;
update comments set content = $deaify$模拟的雪终究是模拟的。真想哪天回拉海洛看一场真的，冻手那种。$deaify$ where id = 2472;
update comments set content = $deaify$跟风去模拟舱堆了个雪人，堆完像块被啃过的石头。算了，我还是负责拍照吧。$deaify$ where id = 2475;
update comments set content = $deaify$？模拟舱居然有下雪模式。刚去翻了一遍菜单，藏得也太深了，找半天才点开。$deaify$ where id = 2476;

commit;


-- ============================================================
-- 三、执行后自检（可选，单独运行）
-- ============================================================
--
-- 1) 确认改写行数：submissions 应为 12，comments 应为 35
-- select count(*) from submissions where content like '%9072这个频率%'
--     or content like '%我抬了%' or content like '%速写，两张并排%'
--     or content like '%不是值班%' or content like '%这玩意儿本身%'
--     or content like '%朝西%';
--
-- 2) 确认禁改区未被波及（应原样返回 5 行）
-- select id, author_name, content from comments
--  where id in (2375, 2463, 2473, 2474, 2477) order by id;
--
-- 3) 确认站内不再有内容完全重复的评论（应返回 0 行）
-- select target_id, author_name, content, count(*)
--   from comments group by 1,2,3 having count(*) > 1;

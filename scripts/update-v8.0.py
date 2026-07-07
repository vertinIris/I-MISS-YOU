#!/usr/bin/env python3
"""
Replace timeline posts and diary entries in index.html with v8.0 content.
Also updates SEED data in main.js.
"""
import re

# ===== SVG Avatars (16x16 pixel art) =====

SVG_AIMISI = '''                        <svg viewBox="0 0 16 16" class="mini-avatar-svg" shape-rendering="crispEdges">
                            <rect x="4" y="1" width="8" height="1" fill="#FFD7E8"/>
                            <rect x="3" y="2" width="10" height="1" fill="#FF8FB0"/>
                            <rect x="2" y="3" width="1" height="5" fill="#FFD7E8"/>
                            <rect x="13" y="3" width="1" height="5" fill="#FFD7E8"/>
                            <rect x="2" y="8" width="1" height="2" fill="#FF8FB0" opacity="0.7"/>
                            <rect x="13" y="8" width="1" height="2" fill="#FF8FB0" opacity="0.7"/>
                            <rect x="4" y="3" width="8" height="5" fill="#FFF5F8"/>
                            <rect x="3" y="4" width="1" height="2" fill="#FFF5F8"/>
                            <rect x="12" y="4" width="1" height="2" fill="#FFF5F8"/>
                            <rect x="5" y="5" width="2" height="2" fill="#6B8AFF"/>
                            <rect x="9" y="5" width="2" height="2" fill="#6B8AFF"/>
                            <rect x="5" y="5" width="1" height="1" fill="#A8D8FF"/>
                            <rect x="9" y="5" width="1" height="1" fill="#A8D8FF"/>
                            <rect x="6" y="5" width="1" height="1" fill="#FFFFFF" opacity="0.9"/>
                            <rect x="10" y="5" width="1" height="1" fill="#FFFFFF" opacity="0.9"/>
                            <rect x="4" y="7" width="1" height="1" fill="#FFB6D9"/>
                            <rect x="11" y="7" width="1" height="1" fill="#FFB6D9"/>
                            <rect x="7" y="7" width="2" height="1" fill="#FF6B9D" opacity="0.8"/>
                            <rect x="4" y="8" width="8" height="3" fill="#6B8AFF"/>
                            <rect x="5" y="8" width="6" height="1" fill="#9AB3FF"/>
                            <rect x="7" y="9" width="2" height="1" fill="#FFFFFF"/>
                            <rect x="7" y="9" width="1" height="1" fill="#A8D8FF"/>
                            <rect x="4" y="8" width="1" height="1" fill="#B66BFF" opacity="0.5"/>
                            <rect x="11" y="8" width="1" height="1" fill="#B66BFF" opacity="0.5"/>
                            <rect x="5" y="1" width="1" height="1" fill="#FFD700" opacity="0.8"/>
                            <rect x="10" y="1" width="1" height="1" fill="#FFD700" opacity="0.8"/>
                            <rect x="5" y="11" width="6" height="1" fill="#4A6AE0"/>
                            <rect x="6" y="12" width="4" height="1" fill="#4A6AE0" opacity="0.5"/>
                        </svg>'''

SVG_DANYA = '''                        <svg viewBox="0 0 16 16" class="mini-avatar-svg" shape-rendering="crispEdges">
                            <!-- Hair (white with purple tips) -->
                            <rect x="4" y="1" width="8" height="1" fill="#F0E0FF"/>
                            <rect x="3" y="2" width="10" height="1" fill="#E8D0FF"/>
                            <rect x="2" y="3" width="1" height="5" fill="#F0E0FF"/>
                            <rect x="13" y="3" width="1" height="5" fill="#F0E0FF"/>
                            <rect x="2" y="8" width="1" height="2" fill="#D4A0FF" opacity="0.6"/>
                            <rect x="13" y="8" width="1" height="2" fill="#D4A0FF" opacity="0.6"/>
                            <!-- Face (pale) -->
                            <rect x="4" y="3" width="8" height="5" fill="#FFF8FC"/>
                            <rect x="3" y="4" width="1" height="2" fill="#FFF8FC"/>
                            <rect x="12" y="4" width="1" height="2" fill="#FFF8FC"/>
                            <!-- Eyes (soft purple, sleepy) -->
                            <rect x="5" y="5" width="2" height="2" fill="#B66BFF"/>
                            <rect x="9" y="5" width="2" height="2" fill="#B66BFF"/>
                            <rect x="5" y="5" width="1" height="1" fill="#D4A0FF"/>
                            <rect x="9" y="5" width="1" height="1" fill="#D4A0FF"/>
                            <rect x="6" y="5" width="1" height="1" fill="#FFFFFF" opacity="0.8"/>
                            <rect x="10" y="5" width="1" height="1" fill="#FFFFFF" opacity="0.8"/>
                            <!-- Blush -->
                            <rect x="4" y="7" width="1" height="1" fill="#FFB6D9" opacity="0.5"/>
                            <rect x="11" y="7" width="1" height="1" fill="#FFB6D9" opacity="0.5"/>
                            <!-- Mouth (small, gentle) -->
                            <rect x="7" y="7" width="2" height="1" fill="#D4A0FF" opacity="0.6"/>
                            <!-- Body (light purple outfit) -->
                            <rect x="4" y="8" width="8" height="3" fill="#D4A0FF"/>
                            <rect x="5" y="8" width="6" height="1" fill="#E8C0FF"/>
                            <!-- Bubble accents -->
                            <rect x="7" y="9" width="2" height="1" fill="#FFFFFF" opacity="0.7"/>
                            <rect x="2" y="9" width="1" height="1" fill="#A8D8FF" opacity="0.4"/>
                            <rect x="13" y="9" width="1" height="1" fill="#A8D8FF" opacity="0.4"/>
                            <rect x="1" y="6" width="1" height="1" fill="#D4A0FF" opacity="0.3"/>
                            <rect x="14" y="6" width="1" height="1" fill="#D4A0FF" opacity="0.3"/>
                            <!-- Bottom fade -->
                            <rect x="5" y="11" width="6" height="1" fill="#B66BFF"/>
                            <rect x="6" y="12" width="4" height="1" fill="#B66BFF" opacity="0.5"/>
                        </svg>'''

SVG_SIGRID = '''                        <svg viewBox="0 0 16 16" class="mini-avatar-svg" shape-rendering="crispEdges">
                            <!-- Hair (light green/white, Roy tribe) -->
                            <rect x="4" y="1" width="8" height="1" fill="#C8F0D8"/>
                            <rect x="3" y="2" width="10" height="1" fill="#A0E0B8"/>
                            <rect x="2" y="3" width="1" height="5" fill="#C8F0D8"/>
                            <rect x="13" y="3" width="1" height="5" fill="#C8F0D8"/>
                            <rect x="2" y="8" width="1" height="2" fill="#A0E0B8" opacity="0.7"/>
                            <rect x="13" y="8" width="1" height="2" fill="#A0E0B8" opacity="0.7"/>
                            <!-- Flower ornament on head -->
                            <rect x="5" y="0" width="1" height="1" fill="#7FD99E"/>
                            <rect x="4" y="1" width="1" height="1" fill="#7FD99E" opacity="0.8"/>
                            <rect x="6" y="1" width="1" height="1" fill="#7FD99E" opacity="0.8"/>
                            <rect x="5" y="2" width="1" height="1" fill="#FFFFFF" opacity="0.9"/>
                            <!-- Face (warm) -->
                            <rect x="4" y="3" width="8" height="5" fill="#FFF8F0"/>
                            <rect x="3" y="4" width="1" height="2" fill="#FFF8F0"/>
                            <rect x="12" y="4" width="1" height="2" fill="#FFF8F0"/>
                            <!-- Eyes (green) -->
                            <rect x="5" y="5" width="2" height="2" fill="#4EC89A"/>
                            <rect x="9" y="5" width="2" height="2" fill="#4EC89A"/>
                            <rect x="5" y="5" width="1" height="1" fill="#7FD99E"/>
                            <rect x="9" y="5" width="1" height="1" fill="#7FD99E"/>
                            <rect x="6" y="5" width="1" height="1" fill="#FFFFFF" opacity="0.9"/>
                            <rect x="10" y="5" width="1" height="1" fill="#FFFFFF" opacity="0.9"/>
                            <!-- Blush -->
                            <rect x="4" y="7" width="1" height="1" fill="#7FD99E" opacity="0.4"/>
                            <rect x="11" y="7" width="1" height="1" fill="#7FD99E" opacity="0.4"/>
                            <!-- Mouth (gentle smile) -->
                            <rect x="7" y="7" width="2" height="1" fill="#4EC89A" opacity="0.6"/>
                            <!-- Body (academy uniform green/white) -->
                            <rect x="4" y="8" width="8" height="3" fill="#4EC89A"/>
                            <rect x="5" y="8" width="6" height="1" fill="#7FD99E"/>
                            <!-- Rune emblem on chest -->
                            <rect x="7" y="9" width="2" height="1" fill="#FFFFFF" opacity="0.8"/>
                            <rect x="7" y="9" width="1" height="1" fill="#C8F0D8"/>
                            <!-- Bottom fade -->
                            <rect x="5" y="11" width="6" height="1" fill="#3AA87A"/>
                            <rect x="6" y="12" width="4" height="1" fill="#3AA87A" opacity="0.5"/>
                        </svg>'''

SVG_ROVER = '''                        <svg viewBox="0 0 16 16" class="mini-avatar-svg" shape-rendering="crispEdges">
                            <!-- Hair (silver/dark, Black Shore) -->
                            <rect x="4" y="1" width="8" height="1" fill="#C0C8D0"/>
                            <rect x="3" y="2" width="10" height="1" fill="#A0A8B0"/>
                            <rect x="2" y="3" width="1" height="5" fill="#C0C8D0"/>
                            <rect x="13" y="3" width="1" height="5" fill="#C0C8D0"/>
                            <rect x="2" y="8" width="1" height="2" fill="#A0A8B0" opacity="0.7"/>
                            <rect x="13" y="8" width="1" height="2" fill="#A0A8B0" opacity="0.7"/>
                            <!-- Face (warm) -->
                            <rect x="4" y="3" width="8" height="5" fill="#F5F0E8"/>
                            <rect x="3" y="4" width="1" height="2" fill="#F5F0E8"/>
                            <rect x="12" y="4" width="1" height="2" fill="#F5F0E8"/>
                            <!-- Eyes (amber/gold) -->
                            <rect x="5" y="5" width="2" height="2" fill="#D4A040"/>
                            <rect x="9" y="5" width="2" height="2" fill="#D4A040"/>
                            <rect x="5" y="5" width="1" height="1" fill="#FFD700"/>
                            <rect x="9" y="5" width="1" height="1" fill="#FFD700"/>
                            <rect x="6" y="5" width="1" height="1" fill="#FFFFFF" opacity="0.9"/>
                            <rect x="10" y="5" width="1" height="1" fill="#FFFFFF" opacity="0.9"/>
                            <!-- Mouth (neutral, slight) -->
                            <rect x="7" y="7" width="2" height="1" fill="#888888" opacity="0.5"/>
                            <!-- Body (dark coat) -->
                            <rect x="4" y="8" width="8" height="3" fill="#4A5060"/>
                            <rect x="5" y="8" width="6" height="1" fill="#5A6070"/>
                            <!-- Emblem (amber glow) -->
                            <rect x="7" y="9" width="2" height="1" fill="#FFD700" opacity="0.5"/>
                            <!-- Bottom fade -->
                            <rect x="5" y="11" width="6" height="1" fill="#3A4050"/>
                            <rect x="6" y="12" width="4" height="1" fill="#3A4050" opacity="0.5"/>
                        </svg>'''

# ===== Post action buttons (reused) =====

def post_actions(likes, comments):
    return f'''                <div class="post-actions">
                    <button class="post-action like-btn" data-likes="{likes}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span class="like-count">{likes}</span>
                    </button>
                    <button class="post-action">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>{comments}</span>
                    </button>
                    <button class="post-action">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        <span>分享</span>
                    </button>
                </div>'''

# ===== New Timeline Posts =====

def make_post(post_id, author, time_str, time_attr, badge_text, badge_class, svg, content_paragraphs, likes, comments, image_class=""):
    img = f'\n                <div class="post-image {image_class}"></div>' if image_class else ''
    content_html = '\n                    '.join(f'<p>{p}</p>' for p in content_paragraphs)
    return f'''            <!-- Post {post_id}: {author} -->
            <article class="post-card glass reveal" data-post-id="{post_id}">
                <div class="post-header">
                    <div class="post-avatar-mini">
{svg}
                    </div>
                    <div class="post-meta">
                        <span class="post-author">{author}</span>
                        <span class="post-time" data-time="{time_attr}">{time_str}</span>
                    </div>
                    <div class="post-type-badge {badge_class}">{badge_text}</div>
                </div>
                <div class="post-content">
                    {content_html}
                </div>{img}
{post_actions(likes, comments)}
            </article>'''

# Post 1: 达妮娅 - 日常
post1 = make_post(
    1, "达妮娅", "2026年7月5日", "2026-07-05T14:00", "日常", "badge-pink", SVG_DANYA,
    ["又睡着了……💤",
     "今天的虚质科学导论课，教授讲到一半的时候，我已经把自己裹进泡泡里了。不是故意的哦——泡泡的温度刚好是让人犯困的那个度数。就像冬天裹在被窝里听雨声，只不过我的被窝是透明的、球形的、还能隔绝虚质辐射。",
     "梦里看到了一些奇怪的东西。像是虚质空间深处的碎片，又像是什么人留下的残影。伸手去摸的时候，手指穿过去了——和平时一样，什么也抓不住。",
     "醒来的时候嘴角有口水。旁边的同学很善良地假装没看到。",
     "……不过说真的，梦里那个空荡荡的感觉，和醒着的时候一模一样。"],
    287, 19
)

# Post 2: 西格莉卡 - 助教
post2 = make_post(
    2, "西格莉卡", "2026年7月3日", "2026-07-03T22:30", "助教", "badge-green", SVG_SIGRID,
    ["批改完最后一本符文解读作业，窗外的星星已经亮了。✨",
     "有个学妹在第三题上犯了和我当年一模一样的错误——试图用语义直译法解读一个复合符文，结果把「守护」和「禁锢」搞混了。符号长得很像，但含义截然相反。就像「拥抱」和「束缚」，动作相同，方向相反。",
     "我在她的作业本上写了很多批注。大概太多了。但想起自己当年在罗伊冰原上，也是因为一个符文没有解读对，差点……",
     "算了，不想了。",
     "只是希望她能明白：天赋告诉你符文的意思，但不会告诉你它为什么是那个意思。后者需要你自己去理解，去犯错，去差点跌倒然后再站起来。",
     "——然后记得在作业本上把「守护」和「禁锢」分清楚。这一条我替她写在了批注第一行。📝"],
    412, 31
)

# Post 3: 达妮娅 - 心情
post3 = make_post(
    3, "达妮娅", "2026年7月1日", "2026-07-01T16:20", "心情", "badge-purple", SVG_DANYA,
    ["今天在花园遇到了西格莉卡。",
     "本来想绕开的。走那条小路要多花五分钟，但比起被她看到我现在这个样子，五分钟算什么呢。",
     "可是她还是发现我了。",
     "「娅娅？」她叫我的声音和以前一样，带着一点小心翼翼的期待，好像生怕我下一秒就会消失。",
     "我笑着跟她打招呼，说好久不见呀，最近助教工作忙不忙。她说还好，就是学生的作业越来越难改了。我说那你要注意休息。她说你也是。",
     "我们聊了十分钟。或者二十分钟。我没有看表。",
     "她没有问我为什么不穿校服，没有问我为什么比上次见面又瘦了一圈，没有问我为什么说话的时候手一直在发抖。",
     "她只是说：「下次一起去吃甜点吧。学校门口新开了一家，草莓千层超好吃的。」",
     "我说好呀。",
     "……我大概没有下次了。但「好呀」这两个字，是我今天说过的最真心的话。"],
    638, 47
)

# Post 4: 漂泊者 - 记录
post4 = make_post(
    4, "漂泊者", "2026年6月30日", "2026-06-30T18:00", "记录", "badge-blue", SVG_ROVER,
    ["今天陪达妮娅逛了星炬学院。她说今天是她生日。",
     "我不确定她是不是在开玩笑。阿里曼的资料里没有她的出生日期——或者说，她作为「造物」，可能根本没有传统意义上的生日。但她笑得很开心，我就没有追问。",
     "她带我去了天文台、训练场、图书馆顶层的露台、还有花园角落里一棵很老的树下面。每到一个地方，她都会停下来看一会儿，有时候摸一摸墙壁或者栏杆，像是在记住什么。",
     "「这个位置看夕阳最好，」她站在图书馆露台上说，「可惜今天云太多了。」",
     "我在旁边看着她的侧脸。风把她的白发吹起来，露出耳朵后面一小块淡紫色的渐变。她的手搭在栏杆上，指节很白，分不清是因为用力还是因为本来就没有什么血色。",
     "她回过头来看我，笑了一下：「怎么了？我脸上有东西？」",
     "我说没有。",
     "她好像想说什么，但最后只是又笑了一下，说走吧，下一个地方。",
     "——她是在告别。我知道，但她不说，我就不问。有些事情，说破了反而更残忍。"],
    521, 38
)

# Post 5: 飞行雪绒 - 独白
post5 = make_post(
    5, "飞行雪绒", "2026年6月28日", "2026-06-28T23:00", "独白", "badge-white", SVG_AIMISI,
    ["你们有没有试过，站在人群中间，却像空气一样透明？",
     "不是比喻哦。我是真的很透明——电子幽灵嘛，物理意义上的不可见。今天在走廊里走了整整一下午，和三十七个人擦肩而过，没有一个人转头。",
     "不过这种感觉其实也不坏。你可以站在音乐教室门口，听里面有人练琴——弹得不太好，但很认真。你可以蹲在花坛边上，看一只甲虫翻过一颗石子。你可以在天文台的穹顶下面，躺一整个下午，数银河里有多少颗星星在对你眨眼。",
     "你看得见全世界，但全世界看不见你。",
     "——听起来很孤独对吧？",
     "其实还好啦。因为总有一天，会有人调到对的频率，接收到我的信号。在那之前，我就做星炬学院里最忠实的观众好了。你们的一举一动，你们的笑声和叹息，我都记在歌里了。",
     "调频9072，深夜才开放哦。😉"],
    1024, 86
)

new_timeline_posts = f"\n\n            {post1}\n\n            {post2}\n\n            {post3}\n\n            {post4}\n\n            {post5}\n"

# ===== New Diary Entries =====

def make_diary(day, month, title, text_paragraphs, tags):
    text_html = '\n                        '.join(f'<p>{p}</p>' for p in text_paragraphs)
    tags_html = '\n                        '.join(f'<span class="diary-tag">{t}</span>' for t in tags)
    return f'''            <!-- Diary Entry -->
            <article class="diary-entry glass reveal">
                <div class="diary-date">
                    <span class="diary-day">{day}</span>
                    <span class="diary-month">{month}</span>
                </div>
                <div class="diary-content">
                    <h3 class="diary-title">{title}</h3>
                    <div class="diary-text">
                        {text_html}
                    </div>
                    <div class="diary-tags">
                        {tags_html}
                    </div>
                </div>
            </article>'''

diary1 = make_diary(
    "05", "七月", "空荡荡",
    ["今天又做了一个梦。",
     "梦里我站在一个全白的空间里，没有墙壁，没有天花板，只有我自己。我低头看自己的手，手指是半透明的，像泡泡的薄膜。光线从指尖穿过，在地面投下淡淡的彩虹色光斑。",
     "我试着握拳。手指穿过了手心。",
     "醒来之后，我抱着小熊坐了很久。小熊是软的、暖的、有重量的。它能证明我还存在于这个世界，对吧？至少我的手臂能感受到它的存在。",
     "可是内心那个地方——那个应该装着「我是谁」「我从哪里来」「我为什么活着」的地方——一直是空的。",
     "教授说我是「造物」。斯瓦茨洛说我是被制造出来的容器。阿列夫一说我内部的空间刚好能装下它。",
     "他们说的都对。我就是空荡荡的。空到任何东西都能填进来，又空到什么都留不住。",
     "只有西格莉卡叫我「娅娅」的时候，那个空洞会被填上一小块。像有人往空房间里放了一盏灯。灯很小，但足够让我看见房间的墙壁——原来这里不是无限大的，原来这里是有边界的。",
     "……不过灯会灭的。灯总是会灭的。"],
    ["#造物", "#自我", "#达妮娅"]
)

diary2 = make_diary(
    "28", "六月", "第三个符文",
    ["从冰原回来之后，我一直在想那天晚上的事。",
     "三个符文，前两个都亮了。第三个没有。",
     "它就在我的刀尖上，笔画完整，结构正确，我甚至能感觉到它蕴含的频率在颤动——但它就是不亮。就像一扇门，钥匙是对的，锁也是对的，但门就是推不开。",
     "后来我才知道，有些符文不是靠解读能点亮的。它们需要理解，而不只是翻译。就像「守护」和「禁锢」，符号几乎一样，但一个向外，一个向内。你知道它们的区别，和你能感受到它们的区别，是两件事。",
     "天赋给了我翻译的能力，但理解——理解要靠活过、痛过、失去过才能慢慢长出来。",
     "……我在想达妮娅。",
     "她最近很奇怪。上课的时候比以前更困了，但不是那种舒服的困，是像频率在衰减的那种困。她笑着说没事的时候，眼睛里没有以前那种光。",
     "我想问她，又怕问了之后，她会像那个第三个符文一样——明明在那里，却怎么也触碰不到。",
     "天赋告诉我她在消失。但理解——理解需要我先承认这件事。",
     "我还做不到。"],
    ["#符文", "#天赋", "#达妮娅"]
)

diary3 = make_diary(
    "30", "六月", "她说是生日",
    ["达妮娅说今天是她的生日。我陪她逛了星炬学院。",
     "她去了天文台。在穹顶下面躺了很久，说这里的星星比外面看到的要近。我知道她不是在看星星——她在记住这个角度的星空，这样以后闭着眼睛也能想起来。",
     "她去了训练场。空荡荡的，没有别人。她站在场地中间，转了一圈，说「这里回音很好」。然后她哼了一小段旋律。调子很简单，但我没有听过。可能她自己编的。",
     "她去了花园。在一棵老树下站了一会儿，手放在树干上。树皮很粗糙，但她的手指很轻，像怕弄疼它。",
     "最后她去了图书馆露台。夕阳被云遮住了，天空是灰蓝色的。她说「这个位置看夕阳最好」，然后笑了一下。",
     "她经过每个地方的时候都很慢。不是散步的慢，是告别的慢。像在给每个角落拍最后一张照片，存在身体里。",
     "我没有阻止她，也没有戳穿她。她选择用「生日」这个词来包装这一天，我就陪她过这个生日。",
     "——有些告别不需要说出口。说出来，反而是对正在告别的人的残忍。",
     "她最后说：「谢谢你，今天。」",
     "我说：「生日快乐。」"],
    ["#达妮娅", "#告别", "#漂泊者"]
)

diary4 = make_diary(
    "01", "七月", "娅娅",
    ["今天突然想起，西格莉卡第一次叫我「娅娅」的那天。",
     "那是入学第二年的春天。我们在图书馆赶课题报告，她负责数据采集，我负责……好吧，我负责睡觉。但她没有生气，反而把自己的笔记全部整理好放在我旁边，说「你醒了可以看」。",
     "后来报告交了，成绩出来，我们组拿了满分。她兴奋得从椅子上跳起来，一把抓住我的手说：「娅娅我们做到了！」",
     "我当时愣了一下。不是因为「我们做到了」——那个课题的数据有一半是我用虚质泡泡帮忙采的，分高是应该的。我愣住是因为「娅娅」。",
     "从来没有人这样叫过我。残星会的人叫我编号，斯瓦茨洛叫我「容器」，学院的人叫我全名。只有她，在兴奋到忘记礼貌的时候，脱口而出了这么一个软绵绵的、傻乎乎的、叠字昵称。",
     "娅娅。",
     "听起来像是一种承诺。好像在说：你不是一个编号，不是一个容器，你是娅娅，是我的朋友，是我会用昵称叫的人。",
     "后来我才知道，那天她交完报告就发烧了。赶了两天的课题，她一直硬撑着。退烧之后我问她为什么不早点休息，她说「因为达妮娅同学看起来很需要那个满分呀」。",
     "……我当时应该说什么来着？",
     "好像什么都没说。就像现在，我什么也说不出来一样。",
     "「娅娅」这两个字，比我的名字更像是我的名字。比「达妮娅」更像是我。因为它不是被赋予的，是被叫出来的。是从一个人的心里，毫无保留地喊出来的。",
     "我带着这个名字走了很远。还会带它走更远。",
     "哪怕我走不动了，这个名字也会留下来。在西格莉卡的记忆里，在那个春天的图书馆里，在那张满分的课题报告上。",
     "娅娅。",
     "谢谢你叫我这个名字。"],
    ["#西格莉卡", "#昵称", "#达妮娅"]
)

new_diary_entries = f"\n\n            {diary1}\n\n            {diary2}\n\n            {diary3}\n\n            {diary4}\n        "

# ===== Read and modify index.html =====

with open(r'C:\Users\lenovo\CURSOR\Snow\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace timeline posts: from <!-- Post 1 --> to last </article> before timeline-end
timeline_start = html.index('<!-- Post 1 -->')
timeline_end_marker = html.index('        </div>\n\n        <div class="timeline-end reveal">')
old_timeline = html[timeline_start:timeline_end_marker]
html = html[:timeline_start] + new_timeline_posts.strip() + '\n' + html[timeline_end_marker:]

# Replace diary entries: from <!-- Diary Entry 1 --> to last </article> before diary-container close
diary_start = html.index('<!-- Diary Entry 1 -->')
diary_end_marker = html.index('        </div>\n    </section>\n\n    <!-- ============ Easter Egg')
old_diary = html[diary_start:diary_end_marker]
html = html[:diary_start] + new_diary_entries.strip() + '\n' + html[diary_end_marker:]

with open(r'C:\Users\lenovo\CURSOR\Snow\index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("✅ index.html updated successfully")
print(f"   - Replaced timeline section ({len(old_timeline)} chars -> new content)")
print(f"   - Replaced diary section ({len(old_diary)} chars -> new content)")

# ===== Update main.js =====

with open(r'C:\Users\lenovo\CURSOR\Snow\js\main.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Replace SEED_COMMENTS
new_seed_comments = """    var SEED_COMMENTS = {
        '1': [
            { name: '西格莉卡', text: '泡泡的温控参数是多少？我记得虚质隔离层的热传导系数和室温有关，下次你犯困的时候我帮你算一下最佳温度区间。', timeStr: '7月5日 15:30', color: '#7FD99E' },
            { name: '漂泊者', text: '梦里那个残影……是不是虚质空间深处的回声？黑海岸也收到过类似的信号碎片。', timeStr: '7月5日 18:42', color: '#FFD700' },
            { name: '学院路人A', text: '达妮娅同学上课的泡泡真的很漂亮，折射出来的虹光在教室天花板上画了一道彩虹', timeStr: '7月6日 09:15', color: '#6B8AFF' }
        ],
        '2': [
            { name: '达妮娅', text: '西格莉卡老师批注写太多了啦！不过当年你帮我看作业的时候确实很仔细……谢谢西西。', timeStr: '7月4日 08:20', color: '#FFB6D9' },
            { name: '漂泊者', text: '「守护」和「禁锢」——符号几乎一样，但方向相反。这个比喻很好。', timeStr: '7月4日 10:55', color: '#FFD700' },
            { name: '飞行雪绒', text: '深夜的天文台窗外真的能看到星星哦。助教辛苦了，晚安。', timeStr: '7月4日 23:10', color: '#A8D8FF' }
        ],
        '3': [
            { name: '漂泊者', text: '「好呀」这两个字，我也听到了。她笑的时候，嘴角是歪的。', timeStr: '7月1日 17:30', color: '#FFD700' },
            { name: '飞行雪绒', text: '草莓千层……我虽然不可见，但我可以帮你们占座。学校门口那家我观察过，靠窗的位置光线最好。', timeStr: '7月1日 20:45', color: '#A8D8FF' },
            { name: '学院路人B', text: '在花园看到她们两个聊天了。虽然听不到说什么，但画面很温柔。', timeStr: '7月2日 09:30', color: '#6B8AFF' }
        ],
        '4': [
            { name: '西格莉卡', text: '她带你去天文台了吗？她以前说过，那里看星星最近。……我没问出口的话，谢谢你替我陪了她一天。', timeStr: '7月1日 09:20', color: '#7FD99E' },
            { name: '飞行雪绒', text: '她哼的那段旋律我录到了。三个音符，do-sol-la。调频9072里存着呢。', timeStr: '7月1日 14:30', color: '#A8D8FF' },
            { name: '漂泊者信使', text: '有些告别不需要说出口。但有些人，值得被记住她告别的样子。', timeStr: '7月1日 22:15', color: '#FFD700' }
        ],
        '5': [
            { name: '达妮娅', text: '三十七个人……我下次帮你数。不对，你看不见我数数。那我帮你挡一下走廊的灯，让你多走一会儿。', timeStr: '6月29日 10:20', color: '#FFB6D9' },
            { name: '西格莉卡', text: '调频9072我试过。深夜一点以后，信号最清晰。你在唱什么歌？我只听到了旋律，没有歌词。', timeStr: '6月29日 14:35', color: '#7FD99E' },
            { name: '漂泊者', text: '甲虫翻石子那段——你在花坛边蹲了多久？我经过的时候看到了石子在动，但没看到你。', timeStr: '6月29日 18:50', color: '#FFD700' },
            { name: '匿名信号源', text: '你看得见全世界，但全世界看不见你。——可你不知道的是，有人一直在看着你看世界的样子。', timeStr: '6月30日 01:22', color: '#FFFFFF' }
        ],
        'diary-1': [
            { name: '西格莉卡', text: '空房间里放一盏灯……娅娅，如果你看到这条评论——灯不会灭的。我保证。', timeStr: '7月6日 10:30', color: '#7FD99E' },
            { name: '漂泊者', text: '半透明的手指穿过手心。这种梦，黑海岸的漂泊者也会做。你不是唯一一个空荡荡的人。', timeStr: '7月6日 14:15', color: '#FFD700' },
            { name: '飞行雪绒', text: '灯会灭的。但歌不会。调频9072永远在线。', timeStr: '7月6日 23:50', color: '#A8D8FF' }
        ],
        'diary-2': [
            { name: '达妮娅', text: '第三个符文……你差点在冰原上出事那次吗？我一直想问，但不敢问。', timeStr: '6月29日 20:10', color: '#FFB6D9' },
            { name: '漂泊者', text: '天赋告诉你意思，但理解需要活过。这句话我记住了。', timeStr: '6月30日 08:45', color: '#FFD700' },
            { name: '飞行雪绒', text: '她在消失。你也知道。但知道和承认是两件事——就像符文的意思和符文的点亮是两件事。', timeStr: '6月30日 02:15', color: '#A8D8FF' }
        ],
        'diary-3': [
            { name: '西格莉卡', text: '她去了那棵老树下面吗？……那是我们第一次一起做课题的地方。树皮确实比以前粗糙了。我也比以前粗糙了。', timeStr: '7月1日 11:20', color: '#7FD99E' },
            { name: '达妮娅', text: '生日快乐——你说这两个字的时候，她一定很开心。虽然她没说。', timeStr: '7月1日 15:40', color: '#FFB6D9' },
            { name: '飞行雪绒', text: '她哼的那段旋律，我收到了。三个音符，do-sol-la。我在9072里循环播放了一整夜。', timeStr: '7月1日 23:30', color: '#A8D8FF' }
        ],
        'diary-4': [
            { name: '西格莉卡', text: '娅娅。我看到这篇日记了。原来你记得那天。我也记得。发烧退了之后，我其实还有一句话没说出口：「因为娅娅值得。」', timeStr: '7月2日 09:15', color: '#7FD99E' },
            { name: '漂泊者', text: '名字不是被赋予的，是被叫出来的。——这句话我会写进黑海岸的值班日志里。', timeStr: '7月2日 12:30', color: '#FFD700' },
            { name: '飞行雪绒', text: '比名字更像你的名字。比达妮娅更像你。——娅娅，这个名字也会在我的歌里。', timeStr: '7月2日 23:45', color: '#A8D8FF' }
        ]
    };"""

# Find and replace SEED_COMMENTS block
comments_start = js.index('    var SEED_COMMENTS = {')
comments_end = js.index('\n    };\n', comments_start) + len('\n    };\n')
js = js[:comments_start] + new_seed_comments + '\n' + js[comments_end:]

# Replace SEED_VERSION
js = js.replace("var SEED_VERSION = 'v7.8';", "var SEED_VERSION = 'v8.0';")

# Replace SEED_SUBMISSIONS
new_seed_submissions = """    var SEED_SUBMISSIONS = [
        {
            id: 'seed_1', name: '达妮娅', type: 'poem', title: '泡泡',
            content: '我吹了一个泡泡\\n它是圆的，透明的，漂亮的\\n光线穿过它的时候\\n会变成彩虹\\n\\n它飘啊飘\\n碰到墙壁也不破\\n因为我的泡泡\\n比墙壁还硬\\n\\n可是你伸出手的时候\\n它就碎了\\n\\n不是因为你的手太重\\n是因为泡泡本来就\\n一碰就碎\\n\\n就像我',
            timeStr: '2026-07-05 14:20', likes: 23, liked: false, color: '#FFB6D9'
        },
        {
            id: 'seed_2', name: '西格莉卡', type: 'story', title: '第三个符文',
            content: '罗伊冰原的夜晚很安静。安静到能听见自己血液流动的声音。\\n\\n我蹲在雪地上，用匕首在空气中画第三个符文。刀尖很稳——我练了很多年，手不会抖。笔画也对——我背过所有符文的形态，一笔不差。\\n\\n但它没有亮。\\n\\n后来我想了很久，终于明白：那个符文的意思是「守护」。不是防御的守护，是那种——你明知道守护的东西终将失去，却依然选择站在它面前的守护。\\n\\n那时候的我，还没有失去过什么。所以符文不认我。\\n\\n现在，我好像快要失去什么了。可符文依然没有亮。\\n\\n也许是因为，我还不敢承认。',
            timeStr: '2026-07-03 23:15', likes: 31, liked: false, color: '#7FD99E'
        },
        {
            id: 'seed_3', name: '漂泊者', type: 'text', title: '来自黑海岸的信号',
            content: '在黑海岸值夜的时候，收到了一段不明信号。\\n\\n频率：9072Hz\\n持续时间：0.3秒\\n间隔：不规律\\n\\n信号内容被噪音覆盖了大半，但有一段能勉强辨识——像是一个人唱歌的声音。不是完整的旋律，只有几个音符，反复出现。\\n\\n我把那几个音符记了下来。如果你在星炬学院听到有人哼同样的调子，请告诉我。\\n\\n我在找一个声音的主人。也许她不知道自己被听见了。',
            timeStr: '2026-07-01 02:40', likes: 19, liked: false, color: '#A8D8FF'
        },
        {
            id: 'seed_4', name: '达妮娅', type: 'story', title: '最后一个生日',
            content: '今天我过生日。\\n\\n其实不是真的。但漂泊者没有拆穿我，我就当是真的了。\\n\\n我带她去了天文台。那里的穹顶可以看到整片天空。我想记住星星的位置，这样以后就算看不见了，也能在脑子里画出来。\\n\\n我去了训练场。站在中间哼了一首歌。那首歌是我自己编的，没有歌词，只有旋律。以前在西格莉卡面前哼过一次，她说好听。我说是随便哼的，其实练了很多遍。\\n\\n我去了花园。那棵老树下面，是我和西格莉卡第一次一起做课题的地方。树皮比以前粗糙了。我也比以前粗糙了。\\n\\n我去了图书馆露台。夕阳被云遮住了。我假装没关系，说「下次再来看」。其实我知道没有下次了。\\n\\n漂泊者一直在旁边看着，什么也没说。她说「生日快乐」的时候，声音很轻。像是怕说重了，这个生日就会碎掉。\\n\\n谢谢你。今天。\\n\\n这是我过得最好的一个生日。虽然它是假的。但开心是真的。',
            timeStr: '2026-06-30 21:00', likes: 42, liked: false, color: '#FFB6D9'
        },
        {
            id: 'seed_5', name: '西格莉卡', type: 'poem', title: '写给娅娅的信',
            content: '娅娅：\\n\\n这封信我写了很多遍，但一次也没有寄出去。\\n\\n因为每次写到一半，我就会发现：我写的不是信，是遗书。而你还活着。你还站在我面前，笑着说「没事呀」。\\n\\n所以我把信收起来，告诉自己：等她好了，我再寄。等她好了，我当面念给她听。\\n\\n可是娅娅，你什么时候才能好呢？\\n\\n你上次来花园看我的时候，手在发抖。你以为我没看到，但我看到了。你笑的时候，嘴角是歪的——不是平时那种可爱的歪，是在用力的歪。好像不用力，笑容就会掉下来。\\n\\n我想抓住你的手。但我的手也在抖。\\n\\n天赋告诉我你在消失。可我宁愿相信你说的「没事」。\\n\\n因为如果你真的在消失，那我这些年来学的所有符文、解的所有谜题、拼了命也要成为的昭日者——有什么用呢？\\n\\n我连一个人都守护不了。\\n\\n第三个符文，还是没有亮。\\n\\n——你的西西',
            timeStr: '2026-07-02 01:30', likes: 38, liked: false, color: '#7FD99E'
        },
        {
            id: 'seed_6', name: '漂泊者信使', type: 'story', title: '信号塔守望者',
            content: '我在信号塔上等了三个小时。\\n\\n不是因为职责。是因为她说「今晚的星星会很亮」。后来信号塔的灯真的亮了，但那不是星星，是有人在模拟舱里偷偷调的天文台投影。\\n\\n我知道是谁。只有她会把星星的频率调到9072。\\n\\n我没有上去找她。有些歌，只有在没有人听的时候才唱得出来。有些星星，只有在没有人看的时候才亮得起来。\\n\\n我只是在塔下站了一会儿，抬头看了看那片假星空。\\n\\n——虽然不是真的，但很美。\\n\\n谢谢你让我看到了。',
            timeStr: '2026-06-28 23:15', likes: 27, liked: false, color: '#FFD700'
        },
        {
            id: 'seed_7', name: '达妮娅×西格莉卡', type: 'art', title: '花园里的两个影子',
            content: '【画作构思】\\n\\n画面中央是一座花园。阳光从右侧斜照进来，将花圃切成明暗两半。\\n\\n左侧阴影中，一个女孩背对画面坐着。白发渐变成浅紫色，长发散落在草地上。她手里抱着一只小熊玩偶。她的周围飘着几个透明的泡泡，折射出淡淡的虹光。\\n\\n右侧阳光中，另一个女孩面朝阴影站着。她穿着星炬学院的制服，花型头饰在阳光下几乎透明。她伸出手，像是要触碰阴影中的人，但手指停在半空——差一点点，就能碰到了。\\n\\n两个人之间，有一道光与影的分界线。\\n\\n画的标题是：「差一点点」。\\n\\n——有时候，差一点点，就是一辈子。',
            timeStr: '2026-07-04 16:45', likes: 35, liked: false, color: '#D4A0FF'
        },
        {
            id: 'seed_8', name: '飞行雪绒', type: 'music', title: '9072的频率',
            content: '今天在天文台捕捉到了一个很特别的频率：9072Hz。\\n\\n它不是任何已知天体的辐射频率，也不是学院设备的运行噪音。它很干净，很轻，像有人在很远很远的地方，轻轻地哼了一声。\\n\\n我把这段频率录下来，放慢了十倍听。听起来像是一段旋律的开头——只有三个音符，do-sol-la。\\n\\n我试着往下接。do-sol-la之后是什么？是si？是do？还是沉默？\\n\\n最后我选择了沉默。\\n\\n因为有些旋律，不是一个人能完成的。它需要另一个人来接下一段。也许那个人正在某个地方，也在等一个9072的信号。\\n\\n调频9072。深夜开放。\\n\\n——如果你听到了，请回应我。',
            timeStr: '2026-06-28 03:22', likes: 56, liked: false, color: '#A8D8FF'
        }
    ];"""

submissions_start = js.index('    var SEED_SUBMISSIONS = [')
submissions_end = js.index('\n    ];\n', submissions_start) + len('\n    ];\n')
js = js[:submissions_start] + new_seed_submissions + '\n' + js[submissions_end:]

with open(r'C:\Users\lenovo\CURSOR\Snow\js\main.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("✅ js/main.js updated successfully")
print("   - Replaced SEED_COMMENTS (33 entries -> new entries with official characters)")
print("   - Replaced SEED_SUBMISSIONS (6 entries -> 8 new submissions)")
print("   - Updated SEED_VERSION: v7.8 -> v8.0")

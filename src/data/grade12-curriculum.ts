/**
 * Content for the /grade-12 page — a self-contained study companion for KRG
 * (Kurdistan Region Government) Grade 12 students studying English.
 *
 * This is original practice material written to follow the general themes
 * covered by the Sunrise 12 coursebook used in Kurdistan schools (reading,
 * grammar review, vocabulary, and exam-style questions). It does not
 * reproduce any textbook's text — passages, questions, and explanations
 * below are all original.
 *
 * Kurdish fields follow the same optional-fallback pattern used for courses
 * and lessons elsewhere in the app (`title_badini ?? title_sorani`). Where a
 * distinct Badini/Kurmanji wording wasn't confidently available, the Badini
 * field is simply omitted so the UI falls back to the Sorani text — a
 * teacher can fill in a more precise Badini translation later.
 */

export interface Grade12VocabWord {
  word: string;
  pos: string;
  meaning_en: string;
  sorani: string;
  badini?: string;
  example: string;
}

export interface Grade12QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export interface Grade12Unit {
  id: string;
  number: number;
  title_en: string;
  title_sorani: string;
  title_badini?: string;
  theme_en: string;
  theme_sorani: string;
  theme_badini?: string;
  grammar: {
    name_en: string;
    name_sorani: string;
    name_badini?: string;
    explanation: string;
    examples: string[];
  };
  vocabulary: Grade12VocabWord[];
  reading: {
    title: string;
    passage: string;
  };
  quiz: Grade12QuizQuestion[];
  writingPrompt: string;
}

export const GRADE12_UNITS: Grade12Unit[] = [
  {
    id: "reading-thinking",
    number: 1,
    title_en: "Reading & Critical Thinking",
    title_sorani: "خوێندنەوە و بیرکردنەوەی وردبینانە",
    theme_en: "Learn how to read a text actively and report what other people say.",
    theme_sorani: "فێربوونی چۆنیەتی خوێندنەوەی چالاک و ڕاپۆرتکردنی قسەی کەسانی تر.",
    grammar: {
      name_en: "Reported (Indirect) Speech",
      name_sorani: "قسەی ڕاپۆرتکراو",
      explanation:
        "When we tell someone what another person said, we don't usually repeat their exact words — we use reported speech instead. Verb tenses normally shift one step into the past (say → said, is → was, will → would), and pronouns and time words change to fit the new speaker and situation (today → that day, tomorrow → the next day). The reporting verb also changes depending on whether the original sentence was a statement, a command, or a question.",
      examples: [
        'Direct: "I am reading a new novel," she said. → Reported: She said (that) she was reading a new novel.',
        'Direct: "Have you finished the chapter?" he asked me. → Reported: He asked me if I had finished the chapter.',
        'Direct: "Don\'t skip the introduction," the teacher said. → Reported: The teacher told us not to skip the introduction.',
      ],
    },
    vocabulary: [
      {
        word: "analyze",
        pos: "v.",
        meaning_en: "to study something closely to understand it",
        sorani: "شیکردنەوە",
        example: "Good readers analyze the writer's purpose before forming an opinion.",
      },
      {
        word: "evidence",
        pos: "n.",
        meaning_en: "facts or details that show something is true",
        sorani: "بەڵگە",
        example: "She supported her argument with strong evidence from the text.",
      },
      {
        word: "perspective",
        pos: "n.",
        meaning_en: "a particular way of viewing a topic",
        sorani: "بۆچوون",
        example: "Reading different perspectives helps you understand an issue fully.",
      },
      {
        word: "assume",
        pos: "v.",
        meaning_en: "to accept something as true without checking",
        sorani: "وا دانان",
        example: "Don't assume you understand the ending until you finish the chapter.",
      },
      {
        word: "summarize",
        pos: "v.",
        meaning_en: "to give the main points briefly, in your own words",
        sorani: "کورتکردنەوە",
        example: "Can you summarize the story in three sentences?",
      },
      {
        word: "context",
        pos: "n.",
        meaning_en: "the background information that helps explain a word or idea",
        sorani: "چوارچێوە",
        example: "You can often guess a new word's meaning from its context.",
      },
    ],
    reading: {
      title: "Why Skilled Readers Ask Questions",
      passage:
        "Good readers do more than move their eyes across a page. Before they start, they look at the title and predict what the text might be about. While reading, they pause to ask themselves questions: Why did the writer choose this example? What is the main argument here? Skilled readers also notice the context of unfamiliar words instead of stopping at every one they don't know. When they finish, they summarize the passage in their own words rather than repeating the author's sentences, which helps them remember the ideas for longer. Teachers often say that a text can have more than one correct perspective, so readers are encouraged to compare their own opinion with the writer's evidence before deciding whether they agree. Learning to read this way takes practice, but it is one of the most useful skills for both the Grade 12 exam and everyday life.",
    },
    quiz: [
      {
        id: "rt-q1",
        prompt: "According to the passage, what should good readers do before they start reading?",
        choices: [
          "Skip the title",
          "Predict what the text is about",
          "Memorize every word",
          "Close the book",
        ],
        correctIndex: 1,
      },
      {
        id: "rt-q2",
        prompt: "Why do skilled readers pay attention to context?",
        choices: [
          "To avoid stopping at every unfamiliar word",
          "To translate the whole text",
          "To find the title",
          "To copy the author's sentences",
        ],
        correctIndex: 0,
      },
      {
        id: "rt-q3",
        prompt: 'Direct: "I will call you tomorrow," she said. Choose the correct reported speech.',
        choices: [
          "She said she will call me tomorrow.",
          "She said she would call me the next day.",
          "She said I will call you tomorrow.",
          "She says she would call me tomorrow.",
        ],
        correctIndex: 1,
      },
      {
        id: "rt-q4",
        prompt: 'Direct: "Where do you live?" he asked me. Choose the correct reported question.',
        choices: [
          "He asked me where do I live.",
          "He asked me where I lived.",
          "He asked where you live.",
          "He asked me where did I live.",
        ],
        correctIndex: 1,
      },
    ],
    writingPrompt:
      "Write a paragraph (120–150 words) describing a book or article that changed the way you think about a topic. Explain the writer's main idea and your own perspective on it.",
  },
  {
    id: "technology-media",
    number: 2,
    title_en: "Technology & the Media",
    title_sorani: "تەکنەلۆژیا و میدیا",
    theme_en: "Explore how technology and media shape modern life, and practice the passive voice.",
    theme_sorani: "لێکۆڵینەوە لە کاریگەری تەکنەلۆژیا و میدیا لەسەر ژیانی ئێمە.",
    grammar: {
      name_en: "The Passive Voice",
      name_sorani: "شێوازی نەیاندراو (Passive)",
      explanation:
        "We use the passive voice when the action itself matters more than who performs it, or when the doer is unknown, obvious, or unimportant. It is formed with a form of be + the past participle (is made, was invented, has been developed). The passive is very common in news and technology writing, because it lets the writer focus on the device, discovery, or event rather than on the person responsible.",
      examples: [
        "Active: Engineers developed the new app last year. → Passive: The new app was developed by engineers last year.",
        "Active: People use smartphones for almost everything today. → Passive: Smartphones are used for almost everything today.",
        "Active: They will launch the satellite next month. → Passive: The satellite will be launched next month.",
      ],
    },
    vocabulary: [
      {
        word: "device",
        pos: "n.",
        meaning_en: "a small machine or tool made for a particular purpose",
        sorani: "ئامێر",
        example: "A smartphone is a device that combines a phone, a camera, and a computer.",
      },
      {
        word: "reliable",
        pos: "adj.",
        meaning_en: "able to be trusted as true or accurate",
        sorani: "متمانەپێکراو",
        example: "Always check whether a website is reliable before quoting it.",
      },
      {
        word: "influence",
        pos: "n./v.",
        meaning_en: "the power to affect someone's opinion or behavior",
        sorani: "کاریگەری",
        example: "Social media can influence how young people see themselves.",
      },
      {
        word: "broadcast",
        pos: "v.",
        meaning_en: "to send out a program on television, radio, or online",
        sorani: "بڵاوکردنەوە",
        example: "The match was broadcast live across the region.",
      },
      {
        word: "innovation",
        pos: "n.",
        meaning_en: "a new idea, method, or invention",
        sorani: "داهێنان",
        example: "The new translation app is an innovation that helps language learners.",
      },
      {
        word: "addiction",
        pos: "n.",
        meaning_en: "being unable to stop doing something harmful",
        sorani: "گیرۆدەیی",
        example: "Doctors are increasingly concerned about phone addiction among teenagers.",
      },
    ],
    reading: {
      title: "A Screen in Every Pocket",
      passage:
        "Fifty years ago, news was broadcast at fixed times on television, and a phone was a device that stayed on a table at home. Today, a single smartphone can do the work of a camera, a newspaper, a bank, and a classroom. This kind of innovation has changed how young people learn, communicate, and form opinions. However, not every source found online is reliable, so students are now taught to check who wrote an article and why before trusting it. Media also has a strong influence on how people see the world, sometimes making a small event feel more important than it really is. At the same time, doctors warn that constant phone use can lead to addiction, with some students checking their screens more than a hundred times a day. Used carefully, technology is a powerful tool; used without limits, it can become a distraction from real life.",
    },
    quiz: [
      {
        id: "tm-q1",
        prompt:
          "What single device could replace a camera, a bank, and a classroom, according to the text?",
        choices: ["A television", "A smartphone", "A newspaper", "A radio"],
        correctIndex: 1,
      },
      {
        id: "tm-q2",
        prompt: "Why are students taught to check who wrote an article?",
        choices: [
          "Because not every online source is reliable",
          "Because articles are always false",
          "Because teachers ban the internet",
          "Because articles never have authors",
        ],
        correctIndex: 0,
      },
      {
        id: "tm-q3",
        prompt:
          'Choose the correct passive form: "Someone invented the internet in the twentieth century."',
        choices: [
          "The internet invented someone in the twentieth century.",
          "The internet was invented in the twentieth century.",
          "The internet is inventing in the twentieth century.",
          "The internet has invent in the twentieth century.",
        ],
        correctIndex: 1,
      },
      {
        id: "tm-q4",
        prompt: 'Choose the correct passive form: "They will announce the results tomorrow."',
        choices: [
          "The results will be announced tomorrow.",
          "The results are announced tomorrow by they.",
          "The results will announce tomorrow.",
          "The results were announced tomorrow.",
        ],
        correctIndex: 0,
      },
    ],
    writingPrompt:
      "Write a paragraph (120–150 words) about one way technology has changed education in Kurdistan. Use at least two passive sentences.",
  },
  {
    id: "environment",
    number: 3,
    title_en: "The Environment",
    title_sorani: "ژینگە",
    theme_en: "Study environmental challenges and practice first and second conditional sentences.",
    theme_sorani: "لێکۆڵینەوە لە کێشە ژینگەییەکان و پاراستنی سروشت.",
    grammar: {
      name_en: "Conditionals (Type 1 & 2)",
      name_sorani: "ڕستە مەرجییەکان (جۆری یەکەم و دووەم)",
      explanation:
        "First conditional sentences (If + present simple, ... will + verb) describe real, likely future situations. Second conditional sentences (If + past simple, ... would + verb) describe unlikely, imagined, or hypothetical situations. Environmental topics often use both: the first conditional to warn about a likely consequence, and the second to imagine a different, sometimes ideal, world.",
      examples: [
        "First: If factories keep releasing smoke without control, air pollution will get worse.",
        "Second: If every city planted more trees, the air would be cleaner.",
        "First: If we don't act now, droughts will become more common in the region.",
      ],
    },
    vocabulary: [
      {
        word: "pollution",
        pos: "n.",
        meaning_en: "dirty or harmful substances in the air, water, or land",
        sorani: "پیسبوونی ژینگە",
        example: "Traffic is one of the main causes of air pollution in big cities.",
      },
      {
        word: "sustainable",
        pos: "adj.",
        meaning_en: "able to continue for a long time without causing harm",
        sorani: "بەردەوام",
        example: "The city is looking for a more sustainable way to manage its water supply.",
      },
      {
        word: "renewable",
        pos: "adj.",
        meaning_en: "(of energy) able to be produced again naturally and never run out",
        sorani: "نوێبووەوە",
        example: "Solar and wind are examples of renewable energy.",
      },
      {
        word: "drought",
        pos: "n.",
        meaning_en: "a long period of unusually low rainfall",
        sorani: "وشکەسالی",
        example: "The region has faced a serious drought for the past three years.",
      },
      {
        word: "endangered",
        pos: "adj.",
        meaning_en: "at risk of disappearing completely",
        sorani: "لەمەترسیدا",
        example: "Several endangered species depend on the region's remaining wetlands.",
      },
      {
        word: "conserve",
        pos: "v.",
        meaning_en: "to protect something and avoid wasting it",
        sorani: "پاراستن",
        example: "Small habits, like fixing a leaking tap, help conserve water.",
      },
    ],
    reading: {
      title: "A Warmer, Drier Kurdistan?",
      passage:
        "Across the Kurdistan Region, farmers have noticed longer summers, shorter rainy seasons, and more frequent drought. Rivers that once supplied water to entire villages now run lower every year, and some animal species that depend on wetlands are considered endangered. Scientists connect these changes to a wider pattern of climate change, driven partly by pollution from vehicles, factories, and the burning of fossil fuels. Environmental groups argue that a more sustainable future is possible if the region invests in renewable sources of energy, such as solar and wind power, instead of relying only on oil and gas. Simple actions can help too: fixing leaking pipes, planting trees, and choosing to walk or use public transport instead of driving. If communities work together to conserve water and energy, the region will be better prepared for the challenges ahead. If nothing changes, however, future generations would inherit a much harder environment than the one we know today.",
    },
    quiz: [
      {
        id: "env-q1",
        prompt: "What have farmers noticed across the Kurdistan Region?",
        choices: [
          "Shorter summers and more rain",
          "Longer summers and more drought",
          "No change in the weather",
          "Colder winters only",
        ],
        correctIndex: 1,
      },
      {
        id: "env-q2",
        prompt: "According to the passage, what could help create a more sustainable future?",
        choices: [
          "Burning more fossil fuels",
          "Investing in renewable energy",
          "Draining more rivers",
          "Ignoring pollution",
        ],
        correctIndex: 1,
      },
      {
        id: "env-q3",
        prompt: "Choose the correct first conditional sentence.",
        choices: [
          "If it rains, the crops will grow.",
          "If it rain, the crops will grow.",
          "If it will rain, the crops grow.",
          "If it rains, the crops would grow.",
        ],
        correctIndex: 0,
      },
      {
        id: "env-q4",
        prompt: "Choose the correct second conditional sentence.",
        choices: [
          "If I am the Minister of Environment, I will plant more forests.",
          "If I were the Minister of Environment, I would plant more forests.",
          "If I was the Minister of Environment, I will plant more forests.",
          "If I will be the Minister of Environment, I would plant more forests.",
        ],
        correctIndex: 1,
      },
    ],
    writingPrompt:
      "Write a paragraph (120–150 words) suggesting two things your city could do to protect the environment. Use at least one first conditional and one second conditional sentence.",
  },
  {
    id: "education-careers",
    number: 4,
    title_en: "Education & Careers",
    title_sorani: "پەروەردە و پیشەکان",
    theme_en:
      "Think about study choices and careers, and practice modal verbs of obligation and advice.",
    theme_sorani: "بیرکردنەوە لەسەر داهاتووی خوێندن و هەڵبژاردنی پیشە.",
    grammar: {
      name_en: "Modals of Obligation & Advice",
      name_sorani: "فیعلە یارمەتیدەرەکانی ئەرک و ئامۆژگاری",
      explanation:
        "Must and have to both express obligation, but must often expresses the speaker's own feeling of necessity, while have to usually refers to a rule that comes from outside the speaker — a school, a law, an employer. Should and ought to give advice or a recommendation rather than a strict obligation. Mustn't expresses prohibition (not allowed), while don't have to means something is simply not necessary — an important difference in exam questions.",
      examples: [
        "Students have to submit their applications before the official deadline.",
        "You mustn't copy another student's work in the exam.",
        "If you want to study medicine, you should start reviewing biology early.",
      ],
    },
    vocabulary: [
      {
        word: "qualification",
        pos: "n.",
        meaning_en: "a skill, degree, or exam result that proves you can do something",
        sorani: "بەڵگەنامە",
        example: "A driving license is a basic qualification for many jobs.",
      },
      {
        word: "ambition",
        pos: "n.",
        meaning_en: "a strong desire to achieve something",
        sorani: "ئارەزوو",
        example: "Her ambition is to become a civil engineer.",
      },
      {
        word: "internship",
        pos: "n.",
        meaning_en: "a short period of supervised work experience",
        sorani: "کارئاموزی",
        example: "He completed a summer internship at a local hospital.",
      },
      {
        word: "curriculum",
        pos: "n.",
        meaning_en: "the subjects and topics taught in a school or course",
        sorani: "بەرنامەی خوێندن",
        example: "The new curriculum includes more practical science lessons.",
      },
      {
        word: "scholarship",
        pos: "n.",
        meaning_en: "money given to support a student's studies",
        sorani: "بۆرسی خوێندن",
        example: "She received a scholarship to study abroad.",
      },
      {
        word: "responsibility",
        pos: "n.",
        meaning_en: "a duty to deal with or take care of something",
        sorani: "بەرپرسیارێتی",
        example: "Managing your own study schedule is a big responsibility in Grade 12.",
      },
    ],
    reading: {
      title: "Choosing a Path After Grade 12",
      passage:
        "For many twelfth-grade students, the months before graduation are filled with an important question: what next? Some students already know their ambition — becoming a doctor, an engineer, or a teacher — while others are still exploring their options. Universities look closely at exam results, but they are increasingly interested in other qualifications too, such as short courses, volunteer work, or an internship completed during the summer. A well-designed curriculum should prepare students not only for exams but also for real decisions, like managing time, money, and responsibility. For students worried about cost, a scholarship can make a real difference, covering tuition or living expenses at a university. Career counselors often advise students to talk to people already working in a field before choosing it, because a job can look very different from the outside than it does day to day. Whatever path a student chooses, planning early usually leads to fewer surprises later.",
    },
    quiz: [
      {
        id: "ec-q1",
        prompt:
          "According to the passage, what are universities increasingly interested in, besides exam results?",
        choices: [
          "A student's height",
          "Volunteer work and internships",
          "A student's phone number",
          "The color of a student's uniform",
        ],
        correctIndex: 1,
      },
      {
        id: "ec-q2",
        prompt: "What can help a student who is worried about the cost of university?",
        choices: ["A scholarship", "A longer curriculum", "A shorter exam", "A part-time textbook"],
        correctIndex: 0,
      },
      {
        id: "ec-q3",
        prompt: "Choose the correct sentence.",
        choices: [
          "You must to submit the form by Friday.",
          "You have to submit the form by Friday.",
          "You should to submit the form by Friday.",
          "You must submitting the form by Friday.",
        ],
        correctIndex: 1,
      },
      {
        id: "ec-q4",
        prompt: "Which sentence expresses that something is NOT necessary?",
        choices: [
          "You mustn't bring a calculator.",
          "You don't have to bring a calculator.",
          "You shouldn't bring a calculator.",
          "You can't bring a calculator.",
        ],
        correctIndex: 1,
      },
    ],
    writingPrompt:
      "Write a paragraph (120–150 words) about a career you are considering. Explain why it interests you and what you must do to prepare for it.",
  },
  {
    id: "human-rights-society",
    number: 5,
    title_en: "Human Rights & Society",
    title_sorani: "مافی مرۆڤ و کۆمەڵگا",
    theme_en: "Discuss equality, justice, and community, and practice defining relative clauses.",
    theme_sorani: "گفتوگۆکردن لەسەر یەکسانی، دادپەروەری و کۆمەڵگای دادپەروەرانە.",
    grammar: {
      name_en: "Defining Relative Clauses",
      name_sorani: "ڕستە پەیوەستکەرە دیاریکەرەکان",
      explanation:
        "A defining relative clause gives essential information about a noun — without it, the sentence would be unclear or incomplete. We use who or that for people, which or that for things, where for places, and whose for possession. Commas are not used with defining relative clauses, and the relative pronoun can sometimes be left out if it is the object of the clause.",
      examples: [
        "A community that supports everyone equally is stronger.",
        "People who face discrimination often need legal protection.",
        "This is a document (that) every citizen should read.",
      ],
    },
    vocabulary: [
      {
        word: "equality",
        pos: "n.",
        meaning_en: "the state of having the same rights and opportunities as others",
        sorani: "یەکسانی",
        example: "The law promises equality regardless of gender or background.",
      },
      {
        word: "justice",
        pos: "n.",
        meaning_en: "fair treatment of people, especially by the legal system",
        sorani: "دادپەروەری",
        example: "Citizens expect the courts to deliver justice fairly and quickly.",
      },
      {
        word: "discrimination",
        pos: "n.",
        meaning_en: "unfair treatment of a person or group based on identity",
        sorani: "جیاکاریکردن",
        example: "The organization works to reduce discrimination in the workplace.",
      },
      {
        word: "freedom",
        pos: "n.",
        meaning_en: "the right to act, speak, or think without unfair restriction",
        sorani: "ئازادی",
        example: "Freedom of speech allows citizens to express their opinions openly.",
      },
      {
        word: "community",
        pos: "n.",
        meaning_en: "a group of people living in the same area or sharing common interests",
        sorani: "کۆمەڵگا",
        example: "The whole community helped rebuild the school after the flood.",
      },
      {
        word: "tolerance",
        pos: "n.",
        meaning_en: "the willingness to accept beliefs or behavior different from your own",
        sorani: "ڕواداری",
        example: "Tolerance between different groups is essential for a peaceful society.",
      },
    ],
    reading: {
      title: "What Makes a Fair Society?",
      passage:
        "A society that treats its members fairly does not happen by accident; it is built through laws, education, and everyday choices. Equality means that people have the same rights and opportunities, regardless of their gender, religion, or background. Justice is the system that is supposed to protect those rights when they are broken, whether through courts, police, or local institutions that people trust. Sadly, discrimination still exists in many communities, often affecting people whose only difference is where they were born or how they worship. Freedom of speech, movement, and belief are rights that many people take for granted until they are taken away. Building a fairer society also requires tolerance — the willingness to accept people whose opinions or lifestyles are different from our own. Grade 12 students who study these ideas are better prepared to become active, responsible citizens who can recognize unfairness and speak up against it.",
    },
    quiz: [
      {
        id: "hr-q1",
        prompt: "According to the passage, what does equality mean?",
        choices: [
          "Everyone must think the same way",
          "People have the same rights and opportunities",
          "Only the rich have rights",
          "Freedom does not matter",
        ],
        correctIndex: 1,
      },
      {
        id: "hr-q2",
        prompt: "What does the passage say tolerance requires?",
        choices: [
          "Ignoring other people completely",
          "Willingness to accept people who are different",
          "Agreeing with everyone always",
          "Avoiding all discussion",
        ],
        correctIndex: 1,
      },
      {
        id: "hr-q3",
        prompt: "Choose the correct defining relative clause.",
        choices: [
          "A community, which supports everyone, is strong.",
          "A community that supports everyone is strong.",
          "A community whom supports everyone is strong.",
          "A community what supports everyone is strong.",
        ],
        correctIndex: 1,
      },
      {
        id: "hr-q4",
        prompt: "Choose the correctly punctuated sentence.",
        choices: [
          "People, who face discrimination, need protection.",
          "People who face discrimination need protection.",
          "People whom face, discrimination need protection.",
          "People who, face discrimination, need protection.",
        ],
        correctIndex: 1,
      },
    ],
    writingPrompt:
      "Write a paragraph (120–150 words) about one right you believe is important for every person. Use at least one defining relative clause.",
  },
  {
    id: "travel-culture",
    number: 6,
    title_en: "Travel, Culture & Tourism",
    title_sorani: "گەشتیاری و کەلتوور",
    theme_en:
      "Explore travel and cultural heritage, and practice the present perfect vs. the past simple.",
    theme_sorani: "ناسینی کەلتوور و میراتی کوردستان لە ڕێگەی گەشتیارییەوە.",
    grammar: {
      name_en: "Present Perfect vs. Past Simple",
      name_sorani: "کاتی ڕابردووی تەواوکراو بەراورد بە ڕابردووی سادە",
      explanation:
        "We use the past simple for actions completed at a specific, finished time in the past (last year, in 2019, when I was ten). We use the present perfect for actions at an unspecified time, or that connect the past to the present, or describe experience up to now (have visited, has never tried). Time expressions like yesterday, last week, and ago usually signal the past simple, while ever, never, already, yet, and since usually signal the present perfect.",
      examples: [
        "I visited Erbil Citadel last summer. (a finished, specific time)",
        "I have visited Erbil Citadel three times. (experience, no specific finished time given)",
        "She has never tried Kurdish dolma before tonight.",
      ],
    },
    vocabulary: [
      {
        word: "heritage",
        pos: "n.",
        meaning_en: "traditions, buildings, and culture passed down from earlier generations",
        sorani: "میرات",
        example: "Erbil Citadel is an important part of the region's cultural heritage.",
      },
      {
        word: "itinerary",
        pos: "n.",
        meaning_en: "a planned route or list of places to visit on a trip",
        sorani: "بەرنامەی گەشت",
        example: "Our itinerary includes two days in the mountains and one in the city.",
      },
      {
        word: "accommodation",
        pos: "n.",
        meaning_en: "a place to stay, such as a hotel or guesthouse",
        sorani: "شوێنی مانەوە",
        example: "The town now offers accommodation for every budget.",
      },
      {
        word: "souvenir",
        pos: "n.",
        meaning_en: "an object you keep to remember a place you visited",
        sorani: "یادگاری",
        example: "She bought a handmade rug as a souvenir.",
      },
      {
        word: "custom",
        pos: "n.",
        meaning_en: "a traditional way of behaving in a particular society",
        sorani: "نەریت",
        example: "Sharing tea with guests is a well-known local custom.",
      },
      {
        word: "destination",
        pos: "n.",
        meaning_en: "the place someone is traveling to",
        sorani: "شوێنی مەبەست",
        example: "The region has become a popular destination for summer travel.",
      },
    ],
    reading: {
      title: "Preserving a Living Heritage",
      passage:
        "The Kurdistan Region has become a popular destination for both local and international visitors, drawn by its mountains, historic sites, and rich cultural heritage. A well-planned itinerary might include a walk through the old bazaars of Erbil, a visit to a mountain village, and an evening enjoying local customs such as traditional music and dance. Tourism has grown quickly, and with it, the range of accommodation available, from simple guesthouses to modern hotels. Many visitors return home with a souvenir — a handmade rug, a piece of jewelry, or a jar of local honey — as a reminder of their trip. Local guides often explain that tourism has changed the region in the last decade, bringing new jobs but also new pressure on historic sites that were never designed for large crowds. Communities are now discussing how they can welcome visitors while still protecting the customs and buildings that make the region special in the first place.",
    },
    quiz: [
      {
        id: "tc-q1",
        prompt: "According to the passage, what has grown quickly along with tourism?",
        choices: [
          "The number of mountains",
          "The range of available accommodation",
          "The price of souvenirs only",
          "The number of rainy days",
        ],
        correctIndex: 1,
      },
      {
        id: "tc-q2",
        prompt: "What new pressure does tourism bring to historic sites, according to the passage?",
        choices: [
          "They become too clean",
          "They face new pressure from large crowds",
          "They are closed permanently",
          "They are moved to another location",
        ],
        correctIndex: 1,
      },
      {
        id: "tc-q3",
        prompt: "Choose the correct sentence.",
        choices: [
          "I have visited Istanbul last year.",
          "I visited Istanbul last year.",
          "I visit Istanbul last year.",
          "I was visiting Istanbul last year ago.",
        ],
        correctIndex: 1,
      },
      {
        id: "tc-q4",
        prompt: "Choose the correct sentence.",
        choices: [
          "She has never tried dolma before.",
          "She never tried dolma before.",
          "She has never try dolma before.",
          "She never has tried dolma before.",
        ],
        correctIndex: 0,
      },
    ],
    writingPrompt:
      "Write a paragraph (120–150 words) about a place in Kurdistan you have visited or would like to visit. Use at least one present perfect and one past simple sentence.",
  },
];

export interface Grade12ExamTip {
  en: string;
  sorani: string;
}

export const GRADE12_EXAM_TIPS: Grade12ExamTip[] = [
  {
    en: "Read the instructions twice before answering — many marks are lost to careless mistakes, not lack of knowledge.",
    sorani:
      "ڕێنماییەکان دوو جار بخوێنەرەوە پێش وەڵامدانەوە — زۆربەی خاڵەکان لەبەر خەتای بێ ئاگایی لەدەست دەچن، نەک لەبەر نەزانین.",
  },
  {
    en: "For reading comprehension, skim the passage first, then read the questions, then go back for details.",
    sorani:
      "بۆ لێکدانەوەی خوێندنەوە، سەرەتا خێرا سەیری دەقەکە بکە، پاشان پرسیارەکان بخوێنەرەوە، دواتر بگەڕێوە بۆ وردەکارییەکان.",
  },
  {
    en: "Review one grammar point a day instead of trying to cover all of them the night before the exam.",
    sorani: "ڕۆژانە یەک خاڵی ڕێزمان بخوێنەرەوە لە جیاتی هەموویان لە شەوی پێش ئیمتیحان.",
  },
  {
    en: "For the writing section, spend two minutes planning your paragraph before you start — an introduction, two supporting points, and a conclusion.",
    sorani:
      "بۆ بەشی نووسین، پێش دەستپێکردن دوو خولەک بۆ پلاندانانی پەراگرافەکەت تەرخان بکە — سەرەتا، دوو خاڵی پشتگیریکەر، و کۆتایی.",
  },
  {
    en: "Keep a small notebook of new words with one example sentence each — reviewing your own examples works better than memorizing long lists.",
    sorani:
      "دەفتەرێکی بچووک بۆ وشە نوێکان ڕابگرە لەگەڵ یەک ڕستەی نموونە بۆ هەریەکەیان — پێداچوونەوە بە نموونەی خۆت باشترە لە بیرکردنەوەی لیستی درێژ.",
  },
];

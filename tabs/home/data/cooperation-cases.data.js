(function exposeHomeCooperationCases(global) {
  "use strict";

  global.HomeCooperationCases = [
    {
      id: "aerospace",
      tabLabel: "中国航天科技集团",
      hideOrgNames: true,
      logo: "assets/icons/cooperation/logo-casc-wordmark.svg",
      logoWide: true,
      logoWidth: 245,
      logoHeight: 36,
      titleLines: ["书生·端砚 × 天玄·千枢", "航天科学发现平台"],
      body: "融合“书生·端砚”的科学智能体能力与“天玄·千枢”的航天领域知识和工具体系，构建航天科学发现平台，支持知识探索、方案生成、仿真分析与协同创新",
      tags: ["电磁超材料", "合金设计", "飞行器气动设计", "发动机研发"],
      features: [
        {
          icon: "assets/icons/cooperation/feature-knowledge.svg",
          title: "知识驱动科研",
          description: "融合航天知识库与科研语料，支撑智能问答与知识发现"
        },
        {
          icon: "assets/icons/cooperation/feature-tools.svg",
          title: "多学科工具集成",
          description: "覆盖超材料、合金设计、气动仿真、CAD/CAE 等专业工具链"
        },
        {
          icon: "assets/icons/cooperation/feature-collab.svg",
          title: "智能科研协同",
          description: "科研助手、对话探索、实验与仿真一体化，提升研发效率"
        }
      ],
      image: "assets/images/cooperation/image-cooperation-aerospace.png?v=20260911-coop2",
      imageAlt: "天玄·千枢航天科学发现平台"
    },
    {
      id: "yazhouwan",
      tabLabel: "崖州湾国家实验室",
      hideOrgNames: true,
      logo: "assets/images/cooperation/logo-yazhouwan.png?v=20260911-coop7",
      logoWide: true,
      logoWidth: 173,
      logoHeight: 48,
      titleLines: ["书生·端砚 × 崖州湾生物育种平台", "智能生物育种平台"],
      body: "融合科学智能体与生物育种知识、数据和工具，打造覆盖遗传评估、选种选配与科研验证的智能育种平台，实现育种决策可配置、可追溯、可复现",
      tags: ["种猪联合选育", "基因组质控与遗传评估", "群体近交和遗传多样性监测", "全群智能选配", "多世代育种方案推演"],
      features: [
        {
          icon: "assets/icons/cooperation/feature-dna.svg",
          title: "智能联合选种",
          description: "整合多源育种数据，评估遗传价值、环境效应与群体风险"
        },
        {
          icon: "assets/icons/cooperation/feature-piggy-bank.svg",
          title: "全群智能选配",
          description: "综合育种值、亲缘与生产条件，生成配种方案并推演多代遗传风险"
        },
        {
          icon: "assets/icons/cooperation/feature-file-check.svg",
          title: "可信科研协同",
          description: "Agent 调度专业工具完成计算，并保留数据、参数、日志与分析结果"
        },
        {
          icon: "assets/icons/cooperation/feature-workflow.svg",
          title: "育种能力持续进化",
          description: "将有效方法沉淀为 Skill 或 Workflow，形成可复用的育种科研能力"
        }
      ],
      image: "assets/images/cooperation/image-cooperation-yazhou.png?v=20260911-coop7",
      imageStroke: true,
      imageAlt: "智能生物育种平台"
    }
  ];
})(window);

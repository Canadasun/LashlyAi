import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const LashlyAi = service("LashlyAi", {
    source: github("Canadasun/LashlyAi", { rootDirectory: "backend" }),
    replicas: 1,
    networking: { privateNetworkEndpoint: "lashlyai" },
  });

  return project("vigilant-acceptance", {
    resources: [LashlyAi],
  });
});

import fs from "fs-extra";
import path from "path";
import prettier from "prettier";
import { snakeCase } from "lodash";
import simpleGit from "simple-git";
import { Changeset } from "@changesets/types";

function getPrettierInstance(cwd: string): typeof prettier {
  try {
    return require(require.resolve("prettier", { paths: [cwd] }));
  } catch (err) {
    if (!err || (err as any).code !== "MODULE_NOT_FOUND") {
      throw err;
    }
    return prettier;
  }
}

async function writeChangeset(
  changeset: Changeset,
  cwd: string
): Promise<string> {
  const { summary, releases } = changeset;

  const changesetBase = path.resolve(cwd, ".changeset");

  // Worth understanding that the ID merely needs to be a unique hash to avoid git conflicts
  // experimenting with human readable ids to make finding changesets easier
  // const changesetID = humanId({
  //   separator: "-",
  //   capitalize: false,
  // });

  const prettierInstance = getPrettierInstance(cwd);
  const prettierConfig = await prettierInstance.resolveConfig(cwd);

  // const newChangesetPath = path.resolve(changesetBase, `${changesetID}.md`);

  // NOTE: The quotation marks in here are really important even though they are
  // not spec for yaml. This is because package names can contain special
  // characters that will otherwise break the parsing step
  const git = simpleGit(cwd);
  releases.forEach(async (release) => {
    const names = release.name.split("/");
    const name = names[names.length - 1];
    const pkg = fs.readJsonSync(
      path.join(cwd, "packages", name, "package.json")
    );

    let summary = "";
    // 检查 tag
    const tags = await git.tags();
    const tag = `${pkg.name}@${pkg.version}`;
    if (tags.all.includes(tag)) {
      const logs = await git.log([
        `${pkg.name}@${pkg.version}..HEAD`,
        "--full-history",
        "--date-order",
        "--decorate=full",
        "--",
        `packages/${name}`,
      ]);
      summary = logs.all.map((s) => `- ${s.message}`).join("\n");
    }

    const newChangesetPath = path.resolve(
      changesetBase,
      `${snakeCase(release.name)}.md`
    );
    const changesetContents = `---
"${release.name}": ${release.type}
---
    
${summary ? "Change records" : "No change"}
${summary}
`;

    await fs.outputFile(
      newChangesetPath,
      // Prettier v3 returns a promise
      await prettierInstance.format(changesetContents, {
        ...prettierConfig,
        parser: "markdown",
      })
    );
  });

  return "temp";
}

export default writeChangeset;

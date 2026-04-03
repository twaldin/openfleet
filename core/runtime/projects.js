const fs = require('fs')
const path = require('path')

function projectsPath(stateDir) {
  return path.join(stateDir, 'projects.json')
}

function loadProjects(stateDir) {
  const defaults = defaultProjects()
  try {
    const data = JSON.parse(fs.readFileSync(projectsPath(stateDir), 'utf8'))
    return {
      projects: {
        ...defaults.projects,
        ...(data.projects || {}),
      },
    }
  } catch {
    return defaults
  }
}

function getProject(stateDir, id) {
  return loadProjects(stateDir).projects[id] || null
}

function listProjects(stateDir) {
  return Object.values(loadProjects(stateDir).projects)
}

function resolveProject(stateDir, input = {}) {
  const projects = listProjects(stateDir)
  const requestedId = input.project_id || input.projectId || input.context?.project_id || null
  if (requestedId) {
    return getProject(stateDir, requestedId)
  }

  const repo = input.repo || input.context?.repo || input.source?.repo || null
  if (!repo) return null
  return projects.find((project) => {
    const repos = [project.repo, ...(project.repo_aliases || [])].filter(Boolean)
    return repos.includes(repo)
  }) || null
}

function defaultProjects() {
  return {
    projects: {},
  }
}

module.exports = {
  getProject,
  listProjects,
  loadProjects,
  projectsPath,
  resolveProject,
}

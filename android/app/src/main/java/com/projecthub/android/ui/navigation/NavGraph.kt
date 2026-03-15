package com.projecthub.android.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.*
import androidx.navigation.compose.*
import com.projecthub.android.ui.auth.AuthViewModel
import com.projecthub.android.ui.auth.LoginScreen
import com.projecthub.android.ui.auth.RegisterScreen
import com.projecthub.android.ui.companies.CompanyDetailScreen
import com.projecthub.android.ui.companies.CompanyListScreen
import com.projecthub.android.ui.home.HomeScreen
import com.projecthub.android.ui.issues.IssueDetailScreen
import com.projecthub.android.ui.issues.IssueFormScreen
import com.projecthub.android.ui.issues.IssueListScreen
import com.projecthub.android.ui.kanban.KanbanScreen
import com.projecthub.android.ui.projects.ProjectDetailScreen
import com.projecthub.android.ui.projects.ProjectListScreen
import com.projecthub.android.ui.settings.SettingsScreen
import com.projecthub.android.ui.timeentries.TimeEntriesScreen
import com.projecthub.android.ui.timeentries.TimeEntryFormScreen
import com.projecthub.android.ui.wiki.WikiDetailScreen
import com.projecthub.android.ui.wiki.WikiListScreen

sealed class Screen(val route: String) {
    // Auth
    object Login : Screen("login")
    object Register : Screen("register")

    // Main with bottom nav
    object Home : Screen("home")
    object Projects : Screen("projects")
    object Issues : Screen("issues")
    object Time : Screen("time")
    object Companies : Screen("companies")

    // Detail screens
    object ProjectDetail : Screen("project/{projectId}") {
        fun createRoute(id: Int) = "project/$id"
    }
    object IssueDetail : Screen("issue/{issueId}") {
        fun createRoute(id: Int) = "issue/$id"
    }
    object IssueCreate : Screen("issue/create?projectId={projectId}") {
        fun createRoute(projectId: Int? = null) =
            if (projectId != null) "issue/create?projectId=$projectId" else "issue/create"
    }
    object IssueEdit : Screen("issue/{issueId}/edit") {
        fun createRoute(id: Int) = "issue/$id/edit"
    }
    object ProjectIssues : Screen("project/{projectId}/issues") {
        fun createRoute(id: Int) = "project/$id/issues"
    }
    object Kanban : Screen("project/{projectId}/kanban") {
        fun createRoute(id: Int) = "project/$id/kanban"
    }
    object WikiList : Screen("project/{projectId}/wiki") {
        fun createRoute(id: Int) = "project/$id/wiki"
    }
    object WikiDetail : Screen("project/{projectId}/wiki/{pageId}") {
        fun createRoute(projectId: Int, pageId: Int) = "project/$projectId/wiki/$pageId"
    }
    object CompanyDetail : Screen("company/{companyId}") {
        fun createRoute(id: Int) = "company/$id"
    }
    object TimeCreate : Screen("time/create?projectId={projectId}") {
        fun createRoute(projectId: Int? = null) =
            if (projectId != null) "time/create?projectId=$projectId" else "time/create"
    }
    object Settings : Screen("settings")
}

data class BottomNavItem(
    val screen: Screen,
    val icon: ImageVector,
    val label: String
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Home, Icons.Default.Home, "ホーム"),
    BottomNavItem(Screen.Projects, Icons.Default.FolderOpen, "プロジェクト"),
    BottomNavItem(Screen.Issues, Icons.Default.BugReport, "チケット"),
    BottomNavItem(Screen.Time, Icons.Default.Timer, "作業時間"),
    BottomNavItem(Screen.Companies, Icons.Default.Business, "会社")
)

@Composable
fun ProjectHubNavGraph() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    val authUiState by authViewModel.uiState.collectAsState()

    // Wait for auth check
    if (authUiState.isCheckingAuth) {
        Box(
            modifier = Modifier,
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
        return
    }

    val startDestination = if (authUiState.isLoggedIn) Screen.Home.route else Screen.Login.route

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // Auth screens (no bottom nav)
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToRegister = { navController.navigate(Screen.Register.route) },
                viewModel = authViewModel
            )
        }

        composable(Screen.Register.route) {
            RegisterScreen(
                onRegisterSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateBack = { navController.popBackStack() },
                viewModel = authViewModel
            )
        }

        // Main app with bottom navigation
        composable(Screen.Home.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Home.route) {
                HomeScreen(
                    onNavigateToProject = { navController.navigate(Screen.ProjectDetail.createRoute(it)) },
                    onNavigateToIssue = { navController.navigate(Screen.IssueDetail.createRoute(it)) }
                )
            }
        }

        composable(Screen.Projects.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Projects.route) {
                ProjectListScreen(
                    onNavigateToProject = { navController.navigate(Screen.ProjectDetail.createRoute(it)) }
                )
            }
        }

        composable(Screen.Issues.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Issues.route) {
                IssueListScreen(
                    projectId = null,
                    onNavigateToIssue = { navController.navigate(Screen.IssueDetail.createRoute(it)) },
                    onNavigateToCreateIssue = { navController.navigate(Screen.IssueCreate.createRoute(it)) }
                )
            }
        }

        composable(Screen.Time.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Time.route) {
                TimeEntriesScreen(
                    projectId = null,
                    onNavigateToCreateEntry = { navController.navigate(Screen.TimeCreate.createRoute(it)) }
                )
            }
        }

        composable(Screen.Companies.route) {
            MainScaffold(navController = navController, currentRoute = Screen.Companies.route) {
                CompanyListScreen(
                    onNavigateToCompany = { navController.navigate(Screen.CompanyDetail.createRoute(it)) }
                )
            }
        }

        // Settings
        composable(Screen.Settings.route) {
            SettingsScreen(
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        // Project detail
        composable(
            route = Screen.ProjectDetail.route,
            arguments = listOf(navArgument("projectId") { type = NavType.IntType })
        ) { backStack ->
            val projectId = backStack.arguments?.getInt("projectId") ?: return@composable
            ProjectDetailScreen(
                projectId = projectId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToIssues = { navController.navigate(Screen.ProjectIssues.createRoute(it)) },
                onNavigateToKanban = { navController.navigate(Screen.Kanban.createRoute(it)) },
                onNavigateToWiki = { navController.navigate(Screen.WikiList.createRoute(it)) }
            )
        }

        // Project issues
        composable(
            route = Screen.ProjectIssues.route,
            arguments = listOf(navArgument("projectId") { type = NavType.IntType })
        ) { backStack ->
            val projectId = backStack.arguments?.getInt("projectId") ?: return@composable
            IssueListScreen(
                projectId = projectId,
                onNavigateToIssue = { navController.navigate(Screen.IssueDetail.createRoute(it)) },
                onNavigateToCreateIssue = { navController.navigate(Screen.IssueCreate.createRoute(it)) }
            )
        }

        // Issue detail
        composable(
            route = Screen.IssueDetail.route,
            arguments = listOf(navArgument("issueId") { type = NavType.IntType })
        ) { backStack ->
            val issueId = backStack.arguments?.getInt("issueId") ?: return@composable
            IssueDetailScreen(
                issueId = issueId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToEdit = { navController.navigate(Screen.IssueEdit.createRoute(it)) }
            )
        }

        // Issue create
        composable(
            route = "issue/create?projectId={projectId}",
            arguments = listOf(navArgument("projectId") {
                type = NavType.IntType
                defaultValue = -1
            })
        ) { backStack ->
            val projectId = backStack.arguments?.getInt("projectId")?.takeIf { it >= 0 }
            IssueFormScreen(
                projectId = projectId,
                issueId = null,
                onNavigateBack = { navController.popBackStack() },
                onSaveSuccess = { issueId ->
                    navController.navigate(Screen.IssueDetail.createRoute(issueId)) {
                        popUpTo("issue/create?projectId={projectId}") { inclusive = true }
                    }
                }
            )
        }

        // Issue edit
        composable(
            route = Screen.IssueEdit.route,
            arguments = listOf(navArgument("issueId") { type = NavType.IntType })
        ) { backStack ->
            val issueId = backStack.arguments?.getInt("issueId") ?: return@composable
            IssueFormScreen(
                projectId = null,
                issueId = issueId,
                onNavigateBack = { navController.popBackStack() },
                onSaveSuccess = { _ ->
                    navController.popBackStack()
                }
            )
        }

        // Kanban
        composable(
            route = Screen.Kanban.route,
            arguments = listOf(navArgument("projectId") { type = NavType.IntType })
        ) { backStack ->
            val projectId = backStack.arguments?.getInt("projectId") ?: return@composable
            KanbanScreen(
                projectId = projectId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToIssue = { navController.navigate(Screen.IssueDetail.createRoute(it)) }
            )
        }

        // Wiki list
        composable(
            route = Screen.WikiList.route,
            arguments = listOf(navArgument("projectId") { type = NavType.IntType })
        ) { backStack ->
            val projectId = backStack.arguments?.getInt("projectId") ?: return@composable
            WikiListScreen(
                projectId = projectId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToPage = { pId, pgId -> navController.navigate(Screen.WikiDetail.createRoute(pId, pgId)) }
            )
        }

        // Wiki detail
        composable(
            route = Screen.WikiDetail.route,
            arguments = listOf(
                navArgument("projectId") { type = NavType.IntType },
                navArgument("pageId") { type = NavType.IntType }
            )
        ) { backStack ->
            val projectId = backStack.arguments?.getInt("projectId") ?: return@composable
            val pageId = backStack.arguments?.getInt("pageId") ?: return@composable
            WikiDetailScreen(
                projectId = projectId,
                pageId = pageId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // Company detail
        composable(
            route = Screen.CompanyDetail.route,
            arguments = listOf(navArgument("companyId") { type = NavType.IntType })
        ) { backStack ->
            val companyId = backStack.arguments?.getInt("companyId") ?: return@composable
            CompanyDetailScreen(
                companyId = companyId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // Time entry create
        composable(
            route = "time/create?projectId={projectId}",
            arguments = listOf(navArgument("projectId") {
                type = NavType.IntType
                defaultValue = -1
            })
        ) { backStack ->
            val projectId = backStack.arguments?.getInt("projectId")?.takeIf { it >= 0 }
            TimeEntryFormScreen(
                projectId = projectId,
                onNavigateBack = { navController.popBackStack() },
                onSaveSuccess = { navController.popBackStack() }
            )
        }
    }
}

@Composable
fun MainScaffold(
    navController: NavController,
    currentRoute: String,
    content: @Composable () -> Unit
) {
    Scaffold(
        bottomBar = {
            NavigationBar {
                bottomNavItems.forEach { item ->
                    NavigationBarItem(
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) },
                        selected = currentRoute == item.screen.route,
                        onClick = {
                            if (currentRoute != item.screen.route) {
                                navController.navigate(item.screen.route) {
                                    popUpTo(navController.graph.startDestinationId) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        }
                    )
                }
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Settings, contentDescription = "設定") },
                    label = { Text("設定") },
                    selected = currentRoute == Screen.Settings.route,
                    onClick = {
                        navController.navigate(Screen.Settings.route)
                    }
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier.padding(paddingValues)
        ) {
            content()
        }
    }
}

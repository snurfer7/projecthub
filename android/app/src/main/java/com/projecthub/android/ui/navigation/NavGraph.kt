package com.projecthub.android.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.*
import androidx.navigation.compose.*
import com.projecthub.android.ui.components.bottomNavItems
import com.projecthub.android.ui.auth.AuthViewModel
import com.projecthub.android.ui.auth.LoginScreen
import com.projecthub.android.ui.auth.RegisterScreen
import com.projecthub.android.ui.companies.ActivityCreateScreen
import com.projecthub.android.ui.companies.BusinessCardScanScreen
import com.projecthub.android.ui.companies.CompanyCommentCreateScreen
import com.projecthub.android.ui.companies.CompanyCreateScreen
import com.projecthub.android.ui.companies.CompanyDetailScreen
import com.projecthub.android.ui.companies.CompanyListScreen
import com.projecthub.android.ui.companies.ContactCreateScreen
import com.projecthub.android.ui.companies.DealCreateScreen
import com.projecthub.android.ui.companies.LocationCreateScreen
import com.projecthub.android.ui.projects.ProjectCreateScreen
import com.projecthub.android.ui.home.HomeScreen
import com.projecthub.android.ui.issues.IssueDetailScreen
import com.projecthub.android.ui.issues.IssueFormScreen
import com.projecthub.android.ui.issues.IssueListScreen
import com.projecthub.android.ui.gantt.GanttScreen
import com.projecthub.android.ui.kanban.KanbanScreen
import com.projecthub.android.ui.projects.ProjectDetailScreen
import com.projecthub.android.ui.projects.ProjectListScreen
import com.projecthub.android.ui.settings.ApiSettingsScreen
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
    object Gantt : Screen("project/{projectId}/gantt") {
        fun createRoute(id: Int) = "project/$id/gantt"
    }
    object WikiList : Screen("project/{projectId}/wiki") {
        fun createRoute(id: Int) = "project/$id/wiki"
    }
    object WikiDetail : Screen("project/{projectId}/wiki/{pageId}") {
        fun createRoute(projectId: Int, pageId: Int) = "project/$projectId/wiki/$pageId"
    }
    object CompanyDetail : Screen("company/{companyId}?tab={tab}") {
        fun createRoute(id: Int) = "company/$id"
        fun createRoute(id: Int, tab: String) = "company/$id?tab=$tab"
    }
    object Contacts : Screen("contacts")
    object Deals : Screen("deals")
    object TimeCreate : Screen("time/create?projectId={projectId}") {
        fun createRoute(projectId: Int? = null) =
            if (projectId != null) "time/create?projectId=$projectId" else "time/create"
    }
    object ProjectCreate : Screen("project/create")
    object CompanyCreate : Screen("company/create")
    object CompanyContactCreate : Screen("company/{companyId}/contact/create") {
        fun createRoute(id: Int) = "company/$id/contact/create"
    }
    object CompanyDealCreate : Screen("company/{companyId}/deal/create") {
        fun createRoute(id: Int) = "company/$id/deal/create"
    }
    object CompanyActivityCreate : Screen("company/{companyId}/activity/create") {
        fun createRoute(id: Int) = "company/$id/activity/create"
    }
    object CompanyCommentCreate : Screen("company/{companyId}/comment/create") {
        fun createRoute(id: Int) = "company/$id/comment/create"
    }
    object CompanyLocationCreate : Screen("company/{companyId}/location/create") {
        fun createRoute(id: Int) = "company/$id/location/create"
    }
    object BusinessCardScan : Screen("company/business_card_scan")
    object Settings : Screen("settings")
    object ApiSettings : Screen("api_settings")
}

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

    // ログアウト時にログイン画面へ遷移
    LaunchedEffect(authUiState.isLoggedIn) {
        if (!authUiState.isLoggedIn) {
            val currentRoute = navController.currentDestination?.route
            if (currentRoute != Screen.Login.route && currentRoute != Screen.Register.route) {
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val authRoutes = setOf(Screen.Login.route, Screen.Register.route, Screen.ApiSettings.route)
    val showBottomNav = currentRoute !in authRoutes

    val activeBottomNavRoute = when {
        currentRoute == Screen.Home.route -> Screen.Home.route
        currentRoute == Screen.Projects.route || currentRoute?.startsWith("project/") == true -> Screen.Projects.route
        currentRoute == Screen.Companies.route || currentRoute?.startsWith("company/") == true ||
            currentRoute == Screen.Contacts.route || currentRoute == Screen.Deals.route -> Screen.Companies.route
        currentRoute == Screen.Settings.route -> Screen.Settings.route
        else -> ""
    }

    Scaffold(
        bottomBar = {
            if (showBottomNav) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                            selected = activeBottomNavRoute == item.screen.route,
                            onClick = {
                                if (currentRoute != item.screen.route) {
                                    navController.navigate(item.screen.route) {
                                        popUpTo(navController.graph.startDestinationId)
                                        launchSingleTop = true
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(bottom = paddingValues.calculateBottomPadding())
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
                    onNavigateToApiSettings = { navController.navigate(Screen.ApiSettings.route) },
                    viewModel = authViewModel
                )
            }

            composable(Screen.ApiSettings.route) {
                ApiSettingsScreen(
                    onNavigateBack = { navController.popBackStack() }
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

            // Main app screens
            composable(Screen.Home.route) {
                HomeScreen(
                    onNavigateToProject = { navController.navigate(Screen.ProjectDetail.createRoute(it)) },
                    onNavigateToIssue = { navController.navigate(Screen.IssueDetail.createRoute(it)) }
                )
            }

            composable(Screen.Projects.route) {
                ProjectListScreen(
                    onNavigateToProject = { navController.navigate(Screen.ProjectDetail.createRoute(it)) },
                    onNavigateToCreate = { navController.navigate(Screen.ProjectCreate.route) }
                )
            }

            composable(Screen.ProjectCreate.route) {
                val parentEntry = remember(it) { navController.getBackStackEntry(Screen.Projects.route) }
                val viewModel: com.projecthub.android.ui.projects.ProjectViewModel = androidx.hilt.navigation.compose.hiltViewModel(parentEntry)
                ProjectCreateScreen(
                    onNavigateBack = { navController.popBackStack() },
                    viewModel = viewModel
                )
            }

            composable(Screen.Issues.route) {
                IssueListScreen(
                    projectId = null,
                    onNavigateToIssue = { navController.navigate(Screen.IssueDetail.createRoute(it)) },
                    onNavigateToCreateIssue = { navController.navigate(Screen.IssueCreate.createRoute(it)) }
                )
            }

            composable(Screen.Time.route) {
                TimeEntriesScreen(
                    projectId = null,
                    onNavigateToCreateEntry = { navController.navigate(Screen.TimeCreate.createRoute(it)) }
                )
            }

            composable(Screen.Companies.route) {
                CompanyListScreen(
                    onNavigateToCompany = { navController.navigate(Screen.CompanyDetail.createRoute(it)) },
                    onNavigateToCreate = { navController.navigate(Screen.CompanyCreate.route) },
                    onNavigateToBusinessCardScan = { navController.navigate(Screen.BusinessCardScan.route) },
                    onNavigateToContacts = { navController.navigate(Screen.Contacts.route) },
                    onNavigateToDeals = { navController.navigate(Screen.Deals.route) }
                )
            }

            composable(Screen.CompanyCreate.route) {
                val parentEntry = remember(it) { navController.getBackStackEntry(Screen.Companies.route) }
                val viewModel: com.projecthub.android.ui.companies.CompanyViewModel = androidx.hilt.navigation.compose.hiltViewModel(parentEntry)
                CompanyCreateScreen(
                    onNavigateBack = { navController.popBackStack() },
                    viewModel = viewModel
                )
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
                    onNavigateToWiki = { navController.navigate(Screen.WikiList.createRoute(it)) },
                    onNavigateToGantt = { navController.navigate(Screen.Gantt.createRoute(it)) }
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
                    onNavigateBack = { navController.popBackStack() },
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
                    onNavigateToEdit = { navController.navigate(Screen.IssueEdit.createRoute(it)) },
                    onNavigateToIssue = { navController.navigate(Screen.IssueDetail.createRoute(it)) }
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

            // Gantt
            composable(
                route = Screen.Gantt.route,
                arguments = listOf(navArgument("projectId") { type = NavType.IntType })
            ) { backStack ->
                val projectId = backStack.arguments?.getInt("projectId") ?: return@composable
                GanttScreen(
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
                arguments = listOf(
                    navArgument("companyId") { type = NavType.IntType },
                    navArgument("tab") { type = NavType.StringType; nullable = true; defaultValue = null }
                )
            ) { backStack ->
                val companyId = backStack.arguments?.getInt("companyId") ?: return@composable
                val tab = backStack.arguments?.getString("tab")
                CompanyDetailScreen(
                    companyId = companyId,
                    initialTab = tab,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToContactCreate = { navController.navigate(Screen.CompanyContactCreate.createRoute(companyId)) },
                    onNavigateToDealCreate = { navController.navigate(Screen.CompanyDealCreate.createRoute(companyId)) },
                    onNavigateToActivityCreate = { navController.navigate(Screen.CompanyActivityCreate.createRoute(companyId)) },
                    onNavigateToCommentCreate = { navController.navigate(Screen.CompanyCommentCreate.createRoute(companyId)) },
                    onNavigateToLocationCreate = { navController.navigate(Screen.CompanyLocationCreate.createRoute(companyId)) },
                    onMergeSuccess = { targetId ->
                        navController.navigate(Screen.CompanyDetail.createRoute(targetId)) {
                            popUpTo(Screen.Companies.route)
                        }
                    }
                )
            }

            // Contacts (cross-company)
            composable(Screen.Contacts.route) {
                com.projecthub.android.ui.crm.ContactsListScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToCompany = { companyId, tab ->
                        navController.navigate(Screen.CompanyDetail.createRoute(companyId, tab))
                    }
                )
            }

            // Deals (cross-company)
            composable(Screen.Deals.route) {
                com.projecthub.android.ui.crm.DealsListScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToCompany = { companyId, tab ->
                        navController.navigate(Screen.CompanyDetail.createRoute(companyId, tab))
                    }
                )
            }

            // Company contact create
            composable(
                route = Screen.CompanyContactCreate.route,
                arguments = listOf(navArgument("companyId") { type = NavType.IntType })
            ) { backStack ->
                val companyId = backStack.arguments?.getInt("companyId") ?: return@composable
                val parentEntry = remember(backStack) { navController.getBackStackEntry(Screen.CompanyDetail.route) }
                val viewModel: com.projecthub.android.ui.companies.CompanyViewModel = androidx.hilt.navigation.compose.hiltViewModel(parentEntry)
                ContactCreateScreen(
                    companyId = companyId,
                    onNavigateBack = { navController.popBackStack() },
                    viewModel = viewModel
                )
            }

            // Company deal create
            composable(
                route = Screen.CompanyDealCreate.route,
                arguments = listOf(navArgument("companyId") { type = NavType.IntType })
            ) { backStack ->
                val companyId = backStack.arguments?.getInt("companyId") ?: return@composable
                val parentEntry = remember(backStack) { navController.getBackStackEntry(Screen.CompanyDetail.route) }
                val viewModel: com.projecthub.android.ui.companies.CompanyViewModel = androidx.hilt.navigation.compose.hiltViewModel(parentEntry)
                DealCreateScreen(
                    companyId = companyId,
                    onNavigateBack = { navController.popBackStack() },
                    viewModel = viewModel
                )
            }

            // Company activity create
            composable(
                route = Screen.CompanyActivityCreate.route,
                arguments = listOf(navArgument("companyId") { type = NavType.IntType })
            ) { backStack ->
                val companyId = backStack.arguments?.getInt("companyId") ?: return@composable
                val parentEntry = remember(backStack) { navController.getBackStackEntry(Screen.CompanyDetail.route) }
                val viewModel: com.projecthub.android.ui.companies.CompanyViewModel = androidx.hilt.navigation.compose.hiltViewModel(parentEntry)
                ActivityCreateScreen(
                    companyId = companyId,
                    onNavigateBack = { navController.popBackStack() },
                    viewModel = viewModel
                )
            }

            // Company comment create
            composable(
                route = Screen.CompanyCommentCreate.route,
                arguments = listOf(navArgument("companyId") { type = NavType.IntType })
            ) { backStack ->
                val companyId = backStack.arguments?.getInt("companyId") ?: return@composable
                val parentEntry = remember(backStack) { navController.getBackStackEntry(Screen.CompanyDetail.route) }
                val viewModel: com.projecthub.android.ui.companies.CompanyViewModel = androidx.hilt.navigation.compose.hiltViewModel(parentEntry)
                CompanyCommentCreateScreen(
                    companyId = companyId,
                    onNavigateBack = { navController.popBackStack() },
                    viewModel = viewModel
                )
            }

            // Company location create
            composable(
                route = Screen.CompanyLocationCreate.route,
                arguments = listOf(navArgument("companyId") { type = NavType.IntType })
            ) { backStack ->
                val companyId = backStack.arguments?.getInt("companyId") ?: return@composable
                val parentEntry = remember(backStack) { navController.getBackStackEntry(Screen.CompanyDetail.route) }
                val viewModel: com.projecthub.android.ui.companies.CompanyViewModel = androidx.hilt.navigation.compose.hiltViewModel(parentEntry)
                LocationCreateScreen(
                    companyId = companyId,
                    onNavigateBack = { navController.popBackStack() },
                    viewModel = viewModel
                )
            }

            // Business card scan
            composable(Screen.BusinessCardScan.route) { backStack ->
                val parentEntry = remember(backStack) {
                    navController.getBackStackEntry(Screen.Companies.route)
                }
                val viewModel: com.projecthub.android.ui.companies.CompanyViewModel =
                    androidx.hilt.navigation.compose.hiltViewModel(parentEntry)
                val listState by viewModel.listUiState.collectAsState()
                BusinessCardScanScreen(
                    onNavigateBack = { navController.popBackStack() },
                    legalEntityNames = listState.legalEntityStatuses.map { it.name },
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
}

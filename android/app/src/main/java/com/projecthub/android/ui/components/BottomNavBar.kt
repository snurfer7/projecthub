package com.projecthub.android.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector
import com.projecthub.android.ui.navigation.Screen

data class BottomNavItem(
    val screen: Screen,
    val icon: ImageVector,
    val label: String
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Home, Icons.Default.Home, "ホーム"),
    BottomNavItem(Screen.Projects, Icons.Default.FolderOpen, "プロジェクト"),
    BottomNavItem(Screen.Companies, Icons.Default.Business, "企業"),
    BottomNavItem(Screen.Settings, Icons.Default.Settings, "設定")
)

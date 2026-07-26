package com.projecthub.android.ui.gantt

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.projecthub.android.ui.components.ErrorScreen
import com.projecthub.android.ui.components.LoadingScreen
import com.projecthub.android.ui.theme.StatusClosed
import java.time.LocalDate
import java.time.temporal.ChronoUnit

private val DAY_WIDTH = 28.dp
private val LABEL_WIDTH = 150.dp
private val ROW_HEIGHT = 44.dp
private val HEADER_HEIGHT = 40.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GanttScreen(
    projectId: Int,
    onNavigateBack: () -> Unit,
    onNavigateToIssue: (Int) -> Unit,
    viewModel: GanttViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(projectId) {
        viewModel.load(projectId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (uiState.projectName.isNotBlank()) "ガント: ${uiState.projectName}" else "ガント") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "戻る")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.load(projectId) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "更新")
                    }
                }
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> LoadingScreen()
            uiState.error != null -> ErrorScreen(
                message = uiState.error!!,
                onRetry = { viewModel.load(projectId) }
            )
            uiState.rows.isEmpty() -> Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text("チケットがありません", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            else -> {
                val hScroll = rememberScrollState()
                val totalDays = ChronoUnit.DAYS.between(uiState.rangeStart, uiState.rangeEnd).toInt() + 1
                val today = remember { LocalDate.now() }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    // Header: date scale
                    Row(modifier = Modifier.height(HEADER_HEIGHT)) {
                        Spacer(modifier = Modifier.width(LABEL_WIDTH))
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .horizontalScroll(hScroll)
                        ) {
                            Box(modifier = Modifier.width(DAY_WIDTH * totalDays)) {
                                for (i in 0 until totalDays) {
                                    val date = uiState.rangeStart.plusDays(i.toLong())
                                    val isWeekend = date.dayOfWeek.value >= 6
                                    val isMonthStart = date.dayOfMonth == 1 || i == 0
                                    Column(
                                        modifier = Modifier
                                            .offset(x = DAY_WIDTH * i)
                                            .width(DAY_WIDTH)
                                            .fillMaxHeight()
                                            .background(
                                                if (isWeekend) MaterialTheme.colorScheme.surfaceVariant
                                                else MaterialTheme.colorScheme.surface
                                            ),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        if (isMonthStart) {
                                            Text(
                                                text = "${date.monthValue}月",
                                                style = MaterialTheme.typography.labelSmall,
                                                fontWeight = FontWeight.SemiBold,
                                                maxLines = 1
                                            )
                                        }
                                        Text(
                                            text = date.dayOfMonth.toString(),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (date == today) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }
                    }
                    Divider()

                    // Rows
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(uiState.rows, key = { it.issue.id }) { row ->
                            GanttRowItem(
                                row = row,
                                rangeStart = uiState.rangeStart,
                                totalDays = totalDays,
                                today = today,
                                hScroll = hScroll,
                                onClick = { onNavigateToIssue(row.issue.id) }
                            )
                            Divider(thickness = 0.5.dp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GanttRowItem(
    row: GanttRow,
    rangeStart: LocalDate,
    totalDays: Int,
    today: LocalDate,
    hScroll: androidx.compose.foundation.ScrollState,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(ROW_HEIGHT)
    ) {
        // Label column
        Row(
            modifier = Modifier
                .width(LABEL_WIDTH)
                .fillMaxHeight()
                .padding(start = 4.dp + (row.depth * 10).dp, end = 4.dp)
                .clickable(onClick = onClick),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "#${row.issue.id} ${row.issue.subject}",
                style = MaterialTheme.typography.labelSmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }

        // Bar area
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .horizontalScroll(hScroll)
        ) {
            Box(
                modifier = Modifier
                    .width(DAY_WIDTH * totalDays)
                    .fillMaxHeight()
            ) {
                // Today marker
                val todayOffset = ChronoUnit.DAYS.between(rangeStart, today)
                if (todayOffset in 0 until totalDays) {
                    Box(
                        modifier = Modifier
                            .offset(x = DAY_WIDTH * todayOffset.toInt())
                            .width(1.dp)
                            .fillMaxHeight()
                            .background(MaterialTheme.colorScheme.error.copy(alpha = 0.5f))
                    )
                }

                if (row.startDate == null && row.endDate == null) {
                    Text(
                        text = "日付未設定",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier
                            .align(Alignment.CenterStart)
                            .padding(start = 4.dp)
                    )
                } else {
                    val start = row.startDate ?: row.endDate!!
                    val end = row.endDate ?: row.startDate!!
                    val offsetDays = ChronoUnit.DAYS.between(rangeStart, start).toInt().coerceAtLeast(0)
                    val durationDays = (ChronoUnit.DAYS.between(start, end).toInt() + 1).coerceAtLeast(1)
                    val barColor = when {
                        row.hasChildren -> MaterialTheme.colorScheme.secondaryContainer
                        row.issue.status?.isClosed == true -> StatusClosed
                        else -> MaterialTheme.colorScheme.primary
                    }
                    Box(
                        modifier = Modifier
                            .offset(x = DAY_WIDTH * offsetDays)
                            .width(DAY_WIDTH * durationDays)
                            .fillMaxHeight()
                            .padding(vertical = 8.dp)
                            .background(barColor, RoundedCornerShape(4.dp))
                            .clickable(onClick = onClick)
                    )
                }
            }
        }
    }
}

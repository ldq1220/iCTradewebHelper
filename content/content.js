menu.appendChild(getTaskBtn);
menu.appendChild(reportTaskBtn);

// 添加到页面
document.body.appendChild(floatBall);
document.body.appendChild(menu);

// 直接显示菜单
menu.classList.add('show');

/* 移除或注释掉 hover 事件监听
let menuHideTimeout; // 用于延迟隐藏菜单

floatBall.addEventListener('mouseenter', () => {
    clearTimeout(menuHideTimeout); // 清除可能存在的隐藏计时器
    menu.classList.add('show');
});

floatBall.addEventListener('mouseleave', () => {
    // 延迟隐藏，给用户时间移动到菜单上
    menuHideTimeout = setTimeout(() => {
        if (!menu.matches(':hover')) { // 检查菜单是否处于hover状态
            menu.classList.remove('show');
        }
    }, 200); // 延迟200毫秒
});

menu.addEventListener('mouseenter', () => {
    clearTimeout(menuHideTimeout); // 当鼠标进入菜单时，取消隐藏
});

// 当鼠标离开菜单时也延迟隐藏
menu.addEventListener('mouseleave', () => {
    menuHideTimeout = setTimeout(() => {
        menu.classList.remove('show');
    }, 200);
});
*/

// 使悬浮球和菜单可拖动
makeDraggable(floatBall, menu);

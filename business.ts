import puppeteer, {Browser} from 'puppeteer';

const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

class Business {

    syncing: boolean = false

    cookie: any | undefined

    getBrowser = async () => {
        const browser = await puppeteer.connect({
            browserWSEndpoint: 'ws://127.0.0.1:3000',
        })

        // local browser need use <page.waitForNavigation()>
        // const browser = await puppeteer.launch({
        //     headless: 'new'
        // });
        return browser
    }

    syncCookie = async (cookie: string, account: string, headers: any) => {
        while (this.syncing == true) {
            await sleep(500)
        }

        if (this.cookie != undefined) {
            return {
                code: 1,
                cookie: this.cookie
            }
        }

        this.syncing = true

        console.log('syncCookie')
        console.log('cookie', cookie)
        console.log('account', account)

        //check state
        const browser = await this.getBrowser()
        let page = await browser.newPage()

        await page.setExtraHTTPHeaders({
            'user-agent': headers['user-agent']
        })

        console.log('created page')
        await page.goto(`${process.env.SERVER_PROXY_URL}/wp-login.php`)
        console.log('goto')

        try {
            await page.waitForNavigation({ timeout: 5000 })
        } catch (error) {
            console.log('waitForNavigation not end')
        }
        console.log('waitForNavigation')

        console.log(await page.title())

        await page.type('#user_login', `user`);
        await page.type('#user_pass', process.env.PASSWORD as string)

        try {
            await page.waitForSelector('[type="checkbox"]');

            const [responseCheck] = await Promise.all([
                // page.waitForNavigation(),
                page.click('[type="checkbox"]')
            ]);
    
            console.log('checkbox', responseCheck)
        } catch (error) {
            console.log('error', error)
        }

        try {
            await page.waitForSelector('[type="submit"]');
            const [responseSubmit] = await Promise.all([
                page.waitForNavigation({ timeout: 5000 }),
                page.click('[type="submit"]')
            ]);
    
            console.log('submit', responseSubmit)
        } catch (error) {
            console.error(error)
        }



        console.log(await page.title())

        const currentCookies = await page.cookies();

        console.log('currentCookies', currentCookies)
        this.cookie = currentCookies
        setTimeout(() => {
            this.cookie = undefined
        }, 20 * 1000);

        this.syncing = false
        return {
            code: 1,
            cookie: currentCookies,
            message: undefined
        }
    }
}

export const business = new Business()

export default business

// business.syncCookie('', 'a', '')